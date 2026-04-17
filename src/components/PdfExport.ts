import jsPDF from 'jspdf';
import type { ReleaseDoc, ExecDoc } from '../api/client';

// ── Colors (matching reference doc style) ────────────────────────────────────
const BLACK: [number, number, number] = [0, 0, 0];
const DARK: [number, number, number] = [51, 51, 51];
const MID: [number, number, number] = [100, 100, 100];
const LIGHT: [number, number, number] = [150, 150, 150];
const GOLD: [number, number, number] = [196, 154, 90];  // amber/gold for code & rules
const TABLE_BORDER: [number, number, number] = [180, 180, 180];


// ── Layout ───────────────────────────────────────────────────────────────────
const PAGE_W = 210;
const PAGE_H = 297;
const M = 20;                          // margin
const CW = PAGE_W - M * 2;            // content width
const HEADER_Y = 12;
const FOOTER_Y = PAGE_H - 12;
const BODY_TOP = 20;
const BODY_BOT = FOOTER_Y - 6;

export function exportPdf(doc: ReleaseDoc, preview = false) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  let y = BODY_TOP;
  let page = 1;
  let totalPages = 0; // filled after first pass
  const isDraft = doc.docStatus !== 'final';

  // ── Page management ─────────────────────────────────────────────────────────

  const needY = (space: number) => {
    if (y + space > BODY_BOT) {
      newPage();
    }
  };

  const newPage = () => {
    drawFooter();
    pdf.addPage();
    page++;
    y = BODY_TOP;
    drawHeader();
  };

  const drawHeader = () => {
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...LIGHT);
    pdf.text(`${doc.release.name}.md`, M, HEADER_Y);
    pdf.text(formatDateShort(doc.release.date), PAGE_W - M, HEADER_Y, { align: 'right' });
  };

  const drawFooter = () => {
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...LIGHT);
    pdf.text(`${page} / 5`, PAGE_W / 2, FOOTER_Y, { align: 'center' });
  };

  // ── Typography primitives ──────────────────────────────────────────────────

  // Document title (like H1)
  const title = (text: string) => {
    needY(16);
    pdf.setFontSize(22);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...BLACK);
    pdf.text(text, M, y);
    y += 10;
  };

  // Section heading (like H2) — with prominent visual separation
  const h2 = (text: string) => {
    needY(24);
    y += 12;  // Extra space before major sections
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...BLACK);
    pdf.text(text, M, y);
    y += 3;
    // Black rule under section
    pdf.setDrawColor(...BLACK);
    pdf.setLineWidth(0.5);
    pdf.line(M, y, PAGE_W - M, y);
    pdf.setLineWidth(0.2);
    y += 6;
  };

  // Sub-heading (like H3)
  const h3 = (text: string) => {
    needY(10);
    y += 2;
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...BLACK);
    pdf.text(text, M, y);
    y += 5;
  };

  // Bold sub-sub heading (like **Risk Factors:**)
  const boldLabel = (text: string) => {
    needY(8);
    y += 2;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...BLACK);
    pdf.text(text, M, y);
    y += 5;
  };

  // Key-value: **Label:** Value
  const kv = (label: string, value: string) => {
    needY(6);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...BLACK);
    pdf.text(`${label}:`, M, y);
    const lw = pdf.getTextWidth(`${label}: `);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...DARK);
    const lines = pdf.splitTextToSize(value || '', CW - lw);
    pdf.text(lines[0] || '', M + lw, y);
    y += 5;
    for (let i = 1; i < lines.length; i++) {
      needY(5);
      pdf.text(lines[i], M + lw, y);
      y += 5;
    }
  };

  // Body text paragraph
  const bodyText = (text: string, indent = 0) => {
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...DARK);
    const lines = pdf.splitTextToSize(text, CW - indent);
    for (const ln of lines) {
      needY(5);
      pdf.text(ln, M + indent, y);
      y += 5;
    }
  };

  // Bullet point (filled black circle)
  const bullet = (text: string, indent = 8) => {
    needY(6);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...BLACK);
    pdf.setFillColor(...BLACK);
    pdf.circle(M + indent - 3, y - 1.3, 0.8, 'F');
    const lines = pdf.splitTextToSize(text, CW - indent - 2);
    pdf.text(lines[0], M + indent, y);
    y += 5;
    for (let i = 1; i < lines.length; i++) {
      needY(5);
      pdf.text(lines[i], M + indent + 2, y);
      y += 5;
    }
  };

  // Checkbox bullet (matching reference style)
  const checkbox = (checked: boolean, text: string) => {
    needY(6);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...BLACK);
    pdf.setFillColor(...BLACK);
    // Bullet dot
    pdf.circle(M + 5, y - 1.3, 0.8, 'F');
    // Checkbox with checkmark or X
    const bx = M + 8;
    const by = y - 3.2;
    const bs = 3.5; // box size
    pdf.setDrawColor(...TABLE_BORDER);
    pdf.rect(bx, by, bs, bs, 'S');
    pdf.setDrawColor(...BLACK);

    if (checked) {
      // Draw checkmark
      pdf.setDrawColor(34, 139, 34); // green
      pdf.setLineWidth(0.6);
      pdf.line(bx + 0.7, by + bs / 2, bx + bs / 3, by + bs - 0.8);
      pdf.line(bx + bs / 3, by + bs - 0.8, bx + bs - 0.7, by + 0.8);
      pdf.setLineWidth(0.2);
      pdf.setDrawColor(...BLACK);
    } else {
      // Draw X for unchecked
      pdf.setDrawColor(180, 180, 180); // light gray
      pdf.setLineWidth(0.4);
      pdf.line(bx + 0.8, by + 0.8, bx + bs - 0.8, by + bs - 0.8);
      pdf.line(bx + bs - 0.8, by + 0.8, bx + 0.8, by + bs - 0.8);
      pdf.setLineWidth(0.2);
      pdf.setDrawColor(...BLACK);
    }

    pdf.setTextColor(...BLACK);
    const lines = pdf.splitTextToSize(text, CW - 16);
    pdf.text(lines[0], M + 14, y);
    y += 5;
    for (let i = 1; i < lines.length; i++) {
      needY(5);
      pdf.text(lines[i], M + 14, y);
      y += 5;
    }
  };

  // Numbered item
  const numbered = (n: number, text: string, indent = 8) => {
    needY(6);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...BLACK);
    pdf.text(`${n}.`, M + indent - 5, y);
    const lines = pdf.splitTextToSize(text, CW - indent - 2);
    pdf.text(lines[0], M + indent, y);
    y += 5;
    for (let i = 1; i < lines.length; i++) {
      needY(5);
      pdf.text(lines[i], M + indent, y);
      y += 5;
    }
  };

  // Section divider - prominent visual break
  const rule = () => {
    y += 8;
    // Black rule for clear section separation
    pdf.setDrawColor(...BLACK);
    pdf.setLineWidth(0.3);
    pdf.line(M, y, PAGE_W - M, y);
    pdf.setLineWidth(0.2);
    y += 6;
  };

  const gap = (mm = 3) => { y += mm; };

  // ── Table (clean style matching reference) ─────────────────────────────────
  const table = (headers: string[], colW: number[], rows: string[][]) => {
    const totalW = colW.reduce((a, b) => a + b, 0);
    const ROW_PAD = 3.5;
    const LINE_H = 4.5;
    const CELL_PAD = 4; // horizontal padding inside cells

    // Header row
    needY(10);
    pdf.setDrawColor(...TABLE_BORDER);
    pdf.setLineWidth(0.3);
    pdf.line(M, y - 1, M + totalW, y - 1); // top border

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...BLACK);
    let cx = M + CELL_PAD;
    for (let i = 0; i < headers.length; i++) {
      const wrapped = pdf.splitTextToSize(headers[i], colW[i] - CELL_PAD * 2);
      for (let l = 0; l < wrapped.length; l++) {
        pdf.text(wrapped[l], cx, y + l * LINE_H + 2);
      }
      cx += colW[i];
    }
    const headerLines = Math.max(...headers.map((h, i) => pdf.splitTextToSize(h, colW[i] - CELL_PAD * 2).length));
    y += headerLines * LINE_H + ROW_PAD + 2;
    pdf.line(M, y, M + totalW, y); // bottom of header

    // Data rows
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      let maxLines = 1;
      for (let c = 0; c < row.length; c++) {
        const wrapped = pdf.splitTextToSize(row[c] || '', colW[c] - CELL_PAD * 2);
        maxLines = Math.max(maxLines, wrapped.length);
      }
      const rh = maxLines * LINE_H + ROW_PAD * 2 + 2;
      needY(rh + 1);

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      cx = M + CELL_PAD;
      for (let c = 0; c < row.length; c++) {
        const cellValue = row[c] || '';
        if (c === 0) {
          pdf.setTextColor(...GOLD);
          pdf.setFont('courier', 'normal');
          pdf.setFontSize(8);
        } else if (cellValue === 'Yes') {
          // Red for "Yes" (breaking changes)
          pdf.setTextColor(200, 50, 50);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9);
        } else {
          pdf.setTextColor(...DARK);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9);
        }
        const wrapped = pdf.splitTextToSize(cellValue, colW[c] - CELL_PAD * 2);
        for (let l = 0; l < wrapped.length; l++) {
          pdf.text(wrapped[l], cx, y + ROW_PAD + 1 + l * LINE_H);
        }
        cx += colW[c];
      }
      y += rh;

      // Row divider
      pdf.setDrawColor(...TABLE_BORDER);
      pdf.line(M, y, M + totalW, y);
    }

    pdf.setLineWidth(0.2);
    y += 8;  // Extra space after tables
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // PAGE 1 — No cover page, content starts immediately (matching reference)
  // ══════════════════════════════════════════════════════════════════════════════

  drawHeader();

  // Document title
  y = 24;
  title(isDraft ? 'Release Notes - DRAFT' : 'Release Notes');
  gap(2);

  // ── Release Information ─────────────────────────────────────────────────────
  h2('Release Information');
  kv('Release Date', formatDateShort(doc.release.date));

  h3('Release Team');
  kv('Release Lead', doc.releaseLead || '—');
  kv('Release Backup', doc.releaseBackup || '—');

  rule();

  // ── Risk Assessment ─────────────────────────────────────────────────────────
  h2('Risk Assessment');
  kv('Risk Level', doc.overallRisk || 'Medium');
  gap(2);

  boldLabel('Risk Factors:');
  const rf = doc.riskFactors ?? {};
  const rfLabels: [string, string][] = [
    ['dbMigrations', 'Database migrations required'],
    ['breakingApiChanges', 'Breaking API changes'],
    ['infrastructureChanges', 'Infrastructure changes'],
    ['thirdPartyDeps', 'Third-party dependency updates'],
    ['securityPatches', 'Security patches included'],
    ['featureFlags', 'Feature flags required'],
    ['rollbackPlan', 'Rollback plan prepared'],
  ];
  for (const [key, label] of rfLabels) checkbox(!!rf[key as keyof typeof rf], label);

  // Collect risk notes: manual ones + ticket-level notes from repos
  const allRiskNotes: string[] = [...(doc.riskNotes ?? [])];
  for (const repo of doc.repos) {
    for (const t of repo.tickets) {
      if (t.notes && !t.excluded) {
        allRiskNotes.push(`${t.id} (${repo.name}): ${t.notes}`);
      }
    }
  }

  if (allRiskNotes.length) {
    gap(2);
    boldLabel('Risk Notes:');
    gap(1);
    const RED: [number, number, number] = [200, 50, 50];
    for (const note of allRiskNotes) {
      needY(6);
      pdf.setFillColor(...RED);
      pdf.circle(M + 5, y - 1.3, 0.8, 'F');

      // Check if note has "Label: description" format
      const colonIdx = note.indexOf(':');
      if (colonIdx > 0 && colonIdx < 60) {
        const label = note.slice(0, colonIdx);
        const desc = note.slice(colonIdx + 1).trim();
        // Bold label part in red
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...RED);
        pdf.text(`${label}:`, M + 8, y);
        const labelW = pdf.getTextWidth(`${label}: `);
        // Description part in red
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...RED);
        const descLines = pdf.splitTextToSize(desc, CW - 8 - labelW);
        if (descLines.length > 0) {
          pdf.text(descLines[0], M + 8 + labelW, y);
        }
        y += 5;
        for (let i = 1; i < descLines.length; i++) {
          needY(5);
          pdf.text(descLines[i], M + 10, y);
          y += 5;
        }
      } else {
        // Plain bullet in red
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...RED);
        const lines = pdf.splitTextToSize(note, CW - 10);
        pdf.text(lines[0], M + 8, y);
        y += 5;
        for (let i = 1; i < lines.length; i++) {
          needY(5);
          pdf.text(lines[i], M + 10, y);
          y += 5;
        }
      }
    }
  }

  rule();

  // ── Release Description ─────────────────────────────────────────────────────
  h2('Release Description');
  if (doc.overview) {
    bodyText(doc.overview);
  }

  rule();

  // ── Changes by Project ──────────────────────────────────────────────────────
  h2('Changes by Project');
  gap(2);

  for (const repo of doc.repos) {
    const visible = repo.tickets.filter(t => !t.excluded);
    needY(12);

    // Repo heading: **name** (path) — bold name, gold monospace path
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...BLACK);
    const repoPath = repo.path || repo.name;
    pdf.text(repo.name, M, y);
    const nameW = pdf.getTextWidth(repo.name + ' ');
    // Path in gold monospace (like the reference)
    pdf.setFont('courier', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...GOLD);
    pdf.text(`(${repoPath})`, M + nameW, y);
    y += 6;

    if (visible.length === 0) {
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(...MID);
      pdf.text('No tickets in this release.', M + 8, y);
      y += 5;
    } else {
      for (const t of visible) {
        needY(6);
        pdf.setFontSize(10);

        // Bullet dot
        pdf.setFillColor(...BLACK);
        pdf.circle(M + 5, y - 1.3, 0.8, 'F');

        // [TICKET-ID] in bold
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...BLACK);
        const ticketPart = `[${t.id}]`;
        pdf.text(ticketPart, M + 8, y);
        const ticketW = pdf.getTextWidth(ticketPart);

        // - description - [@developer]
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(...DARK);
        const devPart = t.assignee ? ` - [@${t.assignee}]` : '';
        const sep = ' - ';
        const titleText = `${sep}${t.title}${devPart}`;
        const titleLines = pdf.splitTextToSize(titleText, CW - 8 - ticketW);
        pdf.text(titleLines[0], M + 8 + ticketW, y);
        y += 5;

        for (let i = 1; i < titleLines.length; i++) {
          needY(5);
          pdf.text(titleLines[i], M + 12, y);
          y += 5;
        }
      }
    }

    gap(4);
  }

  // ── Library Versions ────────────────────────────────────────────────────────
  const hasLibraries = doc.libraryVersions?.length || doc.externalDependencies?.length || doc.dbMigrations?.length || doc.envVarUpdates?.length;
  if (hasLibraries) {
    h2('Library Versions');

    if (doc.libraryVersions?.length) {
      h3('Shared Libraries');
      table(
        ['Library', 'Current Production Version', 'Deployment Version', 'Description', 'Breaking Changes?'],
        [34, 32, 28, 42, 34],
        doc.libraryVersions.map(l => [l.library, l.currentVersion, l.deployVersion, l.description, l.breakingChanges ? 'Yes' : 'No'])
      );
    }

    if (doc.externalDependencies?.length) {
      h3('External Dependencies');
      table(
        ['Dependency', 'Affected Projects', 'Description', 'Breaking Changes?'],
        [34, 34, 62, 40],
        doc.externalDependencies.map(e => [e.dependency, e.affectedProjects, e.description, e.breakingChanges ? 'Yes' : 'No'])
      );
    }

    if (doc.dbMigrations?.length) {
      h3('Database Migrations');
      table(
        ['Migration', 'Affected Database', 'Description'],
        [42, 30, 98],
        doc.dbMigrations.map(m => [m.migration, m.affectedDb, m.description])
      );
    }

    if (doc.envVarUpdates?.length) {
      h3('Environment Variable Updates');
      table(
        ['Variable Name', 'Affected Projects', 'Old Value', 'New Value', 'Description'],
        [40, 28, 30, 30, 42],
        doc.envVarUpdates.map(e => [e.variable, e.affectedProjects, e.oldValue, e.newValue, e.description])
      );
    }

    rule();
  }

  // ── Deployment Plan ─────────────────────────────────────────────────────────
  const hasDeployment = doc.preDeployChecklist?.length || doc.deploymentOrder?.length;
  if (hasDeployment) {
    h2('Deployment Plan');

    if (doc.preDeployChecklist?.length) {
      h3('Pre-Deployment Checklist');
      for (const item of doc.preDeployChecklist) checkbox(item.checked, item.item);
      gap(2);
    }

    if (doc.deploymentOrder?.length) {
      h3('Deployment Order');
      doc.deploymentOrder.forEach((item, i) => numbered(i + 1, item));
      gap(2);
    }

    rule();
  }

  // ── Rollback Plan ───────────────────────────────────────────────────────────
  const hasRollback = doc.rollbackTriggers?.length || doc.rollbackSteps?.length || doc.rollbackTime;
  if (hasRollback) {
    h2('Rollback Plan');

    if (doc.rollbackTriggers?.length) {
      boldLabel('Rollback Trigger Conditions:');
      for (const t of doc.rollbackTriggers) bullet(t);
      gap(2);
    }

    if (doc.rollbackSteps?.length) {
      boldLabel('Rollback Steps:');
      doc.rollbackSteps.forEach((s, i) => numbered(i + 1, s));
      gap(2);
    }

    if (doc.rollbackTime) {
      boldLabel('Estimated Rollback Time:');
      bodyText(doc.rollbackTime, 4);
    }

    rule();
  }

  // ── Known Issues & Limitations ──────────────────────────────────────────────
  if (doc.knownIssues?.length) {
    h2('Known Issues & Limitations');
    for (const issue of doc.knownIssues) bullet(issue);
    rule();
  }

  // ── Communication Plan ──────────────────────────────────────────────────────
  const hasComms = doc.stakeholders?.some(s => s.checked) || doc.deploymentWindow?.start || doc.deploymentWindow?.end;
  if (hasComms) {
    h2('Communication Plan');

    if (doc.stakeholders?.length) {
      h3('Stakeholder Notifications');
      for (const item of doc.stakeholders) checkbox(item.checked, item.item);
      gap(2);
    }

    if (doc.deploymentWindow?.start || doc.deploymentWindow?.end) {
      h3('Deployment Window');
      kv('Start Time', doc.deploymentWindow?.start || '');
      kv('End Time', doc.deploymentWindow?.end || '');
      kv('Estimated Downtime', doc.deploymentWindow?.estimatedDowntime || '');
    }

    rule();
  }

  // ── Post-Deployment ─────────────────────────────────────────────────────────
  if (doc.postDeployChecklist?.length) {
    h2('Post-Deployment');
    h3('Verification Steps');
    for (const item of doc.postDeployChecklist) checkbox(item.checked, item.item);
    rule();
  }

  // ── Additional Notes ────────────────────────────────────────────────────────
  if (doc.additionalNotes?.trim()) {
    h2('Additional Notes');
    bodyText(doc.additionalNotes);
    rule();
  }

  // ── Migration Rollback Scripts ─────────────────────────────────────────────
  const migrationsWithRollback = doc.dbMigrations?.filter(m => m.rollbackScript?.trim()) ?? [];
  if (migrationsWithRollback.length > 0) {
    h2('Migration Rollback Scripts');
    gap(2);

    for (const mig of migrationsWithRollback) {
      needY(20);
      // Migration name as h3
      h3(mig.migration || 'Unnamed Migration');
      if (mig.affectedDb) {
        kv('Affected Database', mig.affectedDb);
      }
      gap(2);

      // Code block with gold border and monospace text
      const codeLines = mig.rollbackScript.split('\n');
      const lineH = 4;
      const codePadding = 4;
      const codeBlockH = codeLines.length * lineH + codePadding * 2;

      needY(codeBlockH + 4);

      // Draw code block background and border
      pdf.setFillColor(245, 245, 240); // light warm gray bg
      pdf.setDrawColor(...GOLD);
      pdf.setLineWidth(0.5);
      pdf.rect(M, y, CW, codeBlockH, 'FD');
      pdf.setLineWidth(0.2);

      // Render code in monospace
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(...DARK);

      let codeY = y + codePadding + 3;
      for (const line of codeLines) {
        const trimmed = line.length > 90 ? line.slice(0, 87) + '...' : line;
        pdf.text(trimmed, M + codePadding, codeY);
        codeY += lineH;
      }

      y += codeBlockH + 6;
    }

    rule();
  }

  // ── Sign-Off ─────────────────────────────────────────────────────────────────
  h2('Sign-Off');
  gap(4);

  // Sign-off rows with proper signature lines
  const signoffData = [
    { role: 'Release Lead', name: doc.signOff?.releaseLead || '' },
    { role: 'Technical Lead', name: doc.signOff?.technicalLead || '' },
    { role: 'QA Lead', name: doc.signOff?.qaLead || '' },
  ];

  const sigLineW = 45; // width of signature underline
  const dateLineW = 25;

  for (const so of signoffData) {
    needY(14);

    // "Role Approval (Name):" then signature line, then Date line
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...BLACK);
    const label = so.name
      ? `${so.role} Approval (${so.name}):`
      : `${so.role} Approval:`;
    pdf.text(label, M, y);
    const labelW = pdf.getTextWidth(label + ' ');

    // Signature line — blank for actual signing
    const sigStartX = M + labelW;
    pdf.setDrawColor(...BLACK);
    pdf.setLineWidth(0.3);
    pdf.line(sigStartX, y + 1, sigStartX + sigLineW, y + 1);
    pdf.setLineWidth(0.2);

    // Date field
    const dateStartX = sigStartX + sigLineW + 8;
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...BLACK);
    pdf.text('Date:', dateStartX, y);
    const dateLabelW = pdf.getTextWidth('Date: ');
    pdf.setDrawColor(...BLACK);
    pdf.setLineWidth(0.3);
    pdf.line(dateStartX + dateLabelW, y + 1, dateStartX + dateLabelW + dateLineW, y + 1);
    pdf.setLineWidth(0.2);

    y += 10;
  }

  gap(8);

  // Template version footer (matching reference)
  needY(12);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(...BLACK);
  pdf.text('Template Version:', M, y);
  pdf.setFont('helvetica', 'normal');
  pdf.text(' 1.0', M + pdf.getTextWidth('Template Version: '), y);
  y += 5;
  pdf.setFont('helvetica', 'bold');
  pdf.text('Last Updated:', M, y);
  pdf.setFont('helvetica', 'normal');
  pdf.text(` ${formatDateShort(doc.release.date)}`, M + pdf.getTextWidth('Last Updated: '), y);

  // Draw footer on last page
  drawFooter();

  // Now go back and fix all page footers with correct total
  totalPages = page;
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    // Overwrite footer area
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, FOOTER_Y - 3, PAGE_W, 10, 'F');
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(...LIGHT);
    pdf.text(`${p} / ${totalPages}`, PAGE_W / 2, FOOTER_Y, { align: 'center' });
  }

  if (preview) {
    const blobUrl = pdf.output('bloburl');
    window.open(blobUrl, '_blank');
  } else {
    pdf.save(`${doc.release.name}.pdf`);
  }
}

function formatDateShort(d: string): string {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toISOString().slice(0, 10);
}

// ══════════════════════════════════════════════════════════════════════════════
// Executive Overview PDF — business-level summary, deliverables, impact, risk
// ══════════════════════════════════════════════════════════════════════════════

export function exportExecOverviewPdf(doc: ExecDoc, preview = false) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const PW = 210, PH = 297, LM = 20, CW = PW - LM * 2;
  const FY = PH - 12;
  let y = 20, page = 1;

  const needY = (s: number) => { if (y + s > FY - 6) { drawFooter(); pdf.addPage(); page++; y = 20; drawHeader(); } };
  const drawHeader = () => { pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...LIGHT); pdf.text('Executive Overview', LM, 12); pdf.text(formatDateShort(doc.releaseDate), PW - LM, 12, { align: 'right' }); };
  const drawFooter = () => { pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...LIGHT); pdf.text(`${page}`, PW / 2, FY, { align: 'center' }); };

  const heading = (t: string) => { needY(20); y += 10; pdf.setFontSize(14); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...BLACK); pdf.text(t, LM, y); y += 2; pdf.setDrawColor(...BLACK); pdf.setLineWidth(0.4); pdf.line(LM, y + 1, PW - LM, y + 1); pdf.setLineWidth(0.2); y += 6; };
  const subh = (t: string) => { needY(10); y += 2; pdf.setFontSize(11); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...BLACK); pdf.text(t, LM, y); y += 5; };
  const para = (t: string) => { if (!t) return; pdf.setFontSize(10); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...DARK); for (const ln of pdf.splitTextToSize(t, CW)) { needY(5); pdf.text(ln, LM, y); y += 5; } };
  const kvl = (l: string, v: string) => { needY(6); pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...BLACK); pdf.text(`${l}:`, LM, y); const lw = pdf.getTextWidth(`${l}: `); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...DARK); pdf.text(v || '—', LM + lw, y); y += 5; };
  const blt = (t: string) => { needY(6); pdf.setFillColor(...BLACK); pdf.circle(LM + 5, y - 1.3, 0.8, 'F'); pdf.setFontSize(10); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...DARK); const ls = pdf.splitTextToSize(t, CW - 10); pdf.text(ls[0], LM + 8, y); y += 5; for (let i = 1; i < ls.length; i++) { needY(5); pdf.text(ls[i], LM + 10, y); y += 5; } };
  const gap = (mm = 3) => { y += mm; };

  drawHeader();
  y = 24;
  pdf.setFontSize(22); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...BLACK);
  pdf.text('Executive Overview', LM, y); y += 10;
  pdf.setFontSize(10); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...MID);
  pdf.text(`${doc.releaseName}  |  ${formatDateShort(doc.releaseDate)}  |  Lead: ${doc.releaseLead || '—'}`, LM, y); y += 8;

  heading('Executive Summary');
  para(doc.executiveSummary);

  heading('Key Deliverables');
  const delivs = (title: string, items: { name: string; description: string }[]) => {
    if (!items.length) return;
    subh(title);
    for (const item of items) blt(item.description ? `${item.name} — ${item.description}` : item.name);
    gap(2);
  };
  delivs('New Features & Capabilities', doc.features);
  delivs('Platform Improvements', doc.improvements);
  delivs('Critical Fixes', doc.fixes);

  heading('Business Impact');
  if (doc.customerExperience) { subh('Customer Experience'); para(doc.customerExperience); gap(2); }
  if (doc.operationalEfficiency) { subh('Operational Efficiency'); para(doc.operationalEfficiency); gap(2); }
  if (doc.revenueGrowth) { subh('Revenue & Growth'); para(doc.revenueGrowth); gap(2); }
  if (doc.riskMitigation) { subh('Risk Mitigation'); para(doc.riskMitigation); gap(2); }

  heading('Release Scope');
  if (doc.totalChanges) kvl('Total Changes', doc.totalChanges);
  if (doc.projectsUpdated) kvl('Projects Updated', doc.projectsUpdated);
  if (doc.keyIntegrations) kvl('Key Integrations', doc.keyIntegrations);

  heading('Risk Assessment');
  kvl('Overall Risk', doc.overallRisk); gap(2);
  if (doc.riskFactors.length) { subh('Key Risk Factors'); for (const f of doc.riskFactors) blt(f); gap(2); }
  if (doc.mitigationStrategies.length) { subh('Mitigation Strategies'); for (const s of doc.mitigationStrategies) blt(s); }

  drawFooter();
  const tp = page;
  for (let p = 1; p <= tp; p++) { pdf.setPage(p); pdf.setFillColor(255, 255, 255); pdf.rect(0, FY - 3, PW, 10, 'F'); pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...LIGHT); pdf.text(`${p} / ${tp}`, PW / 2, FY, { align: 'center' }); }

  if (preview) window.open(pdf.output('bloburl'), '_blank');
  else pdf.save(`${doc.releaseName}-executive-overview.pdf`);
}

// ══════════════════════════════════════════════════════════════════════════════
// Ticket Summaries PDF — plain-language per-ticket summaries
// ══════════════════════════════════════════════════════════════════════════════

export function exportExecSummariesPdf(doc: ExecDoc, preview = false) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const PW = 210, PH = 297, LM = 20, CW = PW - LM * 2;
  const FY = PH - 12;
  let y = 20, page = 1;

  const needY = (s: number) => { if (y + s > FY - 6) { drawFooter(); pdf.addPage(); page++; y = 20; drawHeader(); } };
  const drawHeader = () => { pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...LIGHT); pdf.text('Executive Ticket Summaries', LM, 12); pdf.text(formatDateShort(doc.releaseDate), PW - LM, 12, { align: 'right' }); };
  const drawFooter = () => { pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...LIGHT); pdf.text(`${page}`, PW / 2, FY, { align: 'center' }); };
  const gap = (mm = 3) => { y += mm; };

  drawHeader();
  y = 24;
  pdf.setFontSize(22); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...BLACK);
  pdf.text('Executive Ticket Summaries', LM, y); y += 10;
  pdf.setFontSize(10); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...MID);
  pdf.text(`${doc.releaseName}  |  ${formatDateShort(doc.releaseDate)}  |  Lead: ${doc.releaseLead || '—'}`, LM, y); y += 8;

  // Section heading
  needY(20); y += 10;
  pdf.setFontSize(14); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...BLACK);
  pdf.text('Ticket Summaries', LM, y); y += 2;
  pdf.setDrawColor(...BLACK); pdf.setLineWidth(0.4);
  pdf.line(LM, y + 1, PW - LM, y + 1); pdf.setLineWidth(0.2); y += 6;

  if (!doc.ticketSummaries.length) {
    pdf.setFontSize(10); pdf.setFont('helvetica', 'italic'); pdf.setTextColor(...MID);
    pdf.text('No ticket summaries generated yet.', LM, y);
  } else {
    gap(1);
    for (const t of doc.ticketSummaries) {
      needY(10);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...BLACK);
      const idW = pdf.getTextWidth(t.id + '  ');
      pdf.text(t.id, LM, y);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...DARK);
      const lines = pdf.splitTextToSize(t.summary || '—', CW - idW);
      pdf.text(lines[0], LM + idW, y);
      y += 5;
      for (let i = 1; i < lines.length; i++) { needY(5); pdf.text(lines[i], LM + idW, y); y += 5; }
      gap(1);
    }
  }

  drawFooter();
  const tp = page;
  for (let p = 1; p <= tp; p++) { pdf.setPage(p); pdf.setFillColor(255, 255, 255); pdf.rect(0, FY - 3, PW, 10, 'F'); pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...LIGHT); pdf.text(`${p} / ${tp}`, PW / 2, FY, { align: 'center' }); }

  if (preview) window.open(pdf.output('bloburl'), '_blank');
  else pdf.save(`${doc.releaseName}-ticket-summaries.pdf`);
}
