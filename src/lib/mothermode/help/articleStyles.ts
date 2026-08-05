/**
 * The stylesheet for Help Center article and changelog bodies.
 *
 * The article body renders inside a `.prose` container on the public page and
 * inside a bare iframe body in the admin preview. Tailwind's typography plugin
 * (`prose`) aggressively resets margins, headings, tables, and images, so every
 * rule here is written with enough specificity to win over the plugin: selectors
 * are prefixed with `.prose` (which also matches inside the iframe when we add
 * the class there) and key properties are re-asserted.
 *
 * Palette: bone background #F5F1EB, ink text #1A1816, brass accent #A88B5C.
 */

export const ARTICLE_BODY_STYLES = `
  /* Undo the typography plugin's resets on our custom blocks. */
  .prose .intro-box, .prose .step, .prose .callout,
  .prose .table-wrap, .prose .media-slot { margin-left: 0; margin-right: 0; }

  /* Embedded media keeps to the column and rounds off. */
  .prose img, .prose video, .prose iframe,
  body img, body video, body iframe { max-width: 100%; border-radius: 12px; }

  /* ---- Intro box: the at-a-glance pill under the title ---- */
  .prose .intro-box, .intro-box {
    display: grid; gap: 2px;
    border: 1px solid rgba(168, 139, 92, 0.35);
    background: rgba(168, 139, 92, 0.07);
    border-radius: 14px; padding: 16px 20px; margin: 24px 0 12px;
  }
  .prose .intro-row, .intro-row { display: flex; gap: 14px; align-items: baseline; padding: 3px 0; margin: 0; }
  .prose .intro-key, .intro-key {
    flex: 0 0 150px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em;
    text-transform: uppercase; color: #A88B5C;
  }
  .prose .intro-val, .intro-val { font-size: 14px; color: rgba(26, 24, 22, 0.82); }

  /* ---- Step cards: the numbered walkthrough ---- */
  .prose .step, .step {
    display: flex; flex-direction: column;
    border: 1px solid rgba(26, 24, 22, 0.12); border-left: 4px solid #A88B5C;
    border-radius: 14px; background: #fff; margin: 16px 0; overflow: hidden;
    box-shadow: 0 1px 2px rgba(26, 24, 22, 0.04);
  }
  .prose .step-head, .step-head {
    display: flex; align-items: flex-start; gap: 14px;
    padding: 16px 20px 0; margin: 0;
  }
  .prose .step-num, .step-num {
    flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; border-radius: 999px;
    background: #A88B5C; color: #F5F1EB; font-weight: 800; font-size: 16px; line-height: 1;
    margin-top: 2px;
  }
  .prose .step-head h3, .step-head h3 {
    margin: 0; padding: 5px 0 0; font-size: 17px; font-weight: 700;
    color: #1A1816; line-height: 1.3;
  }
  .prose .step-body, .step-body { padding: 6px 20px 18px 20px; margin: 0; }
  @media (min-width: 640px) {
    .prose .step-body, .step-body { padding-left: 66px; }
  }
  .prose .step-body p, .step-body p {
    margin: 8px 0 0; font-size: 15px; line-height: 1.65; color: rgba(26, 24, 22, 0.78);
  }

  /* ---- Callouts ---- */
  .prose .callout, .callout {
    border-radius: 14px; padding: 14px 20px; margin: 18px 0;
    border: 1px solid; box-shadow: 0 1px 2px rgba(26, 24, 22, 0.03);
  }
  .prose .callout p, .callout p { margin: 6px 0 0; font-size: 14.5px; line-height: 1.6; }
  .prose .callout p:first-child, .callout p:first-child { margin-top: 0; }
  .prose .callout-title, .callout-title { margin: 0; font-weight: 700; font-size: 13.5px; letter-spacing: 0.01em; }
  .prose .callout-info, .callout-info { background: rgba(168, 139, 92, 0.09); border-color: rgba(168, 139, 92, 0.4); }
  .prose .callout-info .callout-title, .callout-info .callout-title { color: #8a6f45; }
  .prose .callout-tip, .callout-tip { background: rgba(44, 122, 63, 0.07); border-color: rgba(44, 122, 63, 0.3); }
  .prose .callout-tip .callout-title, .callout-tip .callout-title { color: #2c7a3f; }
  .prose .callout-warn, .callout-warn { background: rgba(204, 134, 22, 0.09); border-color: rgba(204, 134, 22, 0.4); }
  .prose .callout-warn .callout-title, .callout-warn .callout-title { color: #9c6a12; }

  /* ---- Chip: a click target / keycap ---- */
  .prose .chip, .chip {
    display: inline-block; padding: 1px 8px; border-radius: 7px;
    border: 1px solid rgba(26, 24, 22, 0.28); border-bottom-width: 2px;
    background: #fff; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12.5px; color: #1A1816; white-space: nowrap;
  }

  /* ---- Tables ---- */
  .prose .table-wrap, .table-wrap {
    overflow-x: auto; margin: 20px 0;
    border: 1px solid rgba(26, 24, 22, 0.12); border-radius: 14px; background: #fff;
  }
  .prose .table-wrap table, .table-wrap table {
    width: 100%; border-collapse: collapse; font-size: 14px; margin: 0;
  }
  .prose .table-wrap thead, .table-wrap thead { border-bottom: 2px solid rgba(26, 24, 22, 0.12); }
  .prose .table-wrap th, .table-wrap th {
    text-align: left; padding: 12px 16px; background: rgba(168, 139, 92, 0.12);
    color: #1A1816; font-weight: 700; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase;
  }
  .prose .table-wrap td, .table-wrap td {
    padding: 11px 16px; border-top: 1px solid rgba(26, 24, 22, 0.07);
    color: rgba(26, 24, 22, 0.8); vertical-align: top; line-height: 1.55;
  }
  .prose .table-wrap tbody tr:first-child td, .table-wrap tbody tr:first-child td { border-top: 0; }
  .prose .table-wrap tbody tr:nth-child(even) td, .table-wrap tbody tr:nth-child(even) td {
    background: rgba(168, 139, 92, 0.04);
  }

  /* ---- Media slot: the dashed placeholder for a future video/screenshot ---- */
  .prose .media-slot, .media-slot {
    border: 2px dashed rgba(168, 139, 92, 0.55); border-radius: 14px;
    background: rgba(168, 139, 92, 0.08); padding: 28px 24px; margin: 28px 0; text-align: center;
  }
  .prose .media-slot p, .media-slot p { margin: 0; color: rgba(26, 24, 22, 0.58); font-size: 14.5px; }
  .prose .media-slot p strong, .media-slot p strong { color: #A88B5C; display: block; margin-bottom: 5px; }
  .prose .media-slot::after, .media-slot::after {
    content: attr(data-media); display: block; margin-top: 10px; font-size: 11px;
    color: rgba(26, 24, 22, 0.42); font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  /* ---- Section headings inside the body ---- */
  .prose h2 {
    margin-top: 40px; margin-bottom: 6px; font-size: 22px; font-weight: 700;
    color: #1A1816; letter-spacing: -0.01em;
  }
  .prose h2 + p, .prose h2 + .table-wrap, .prose h2 + .step,
  .prose h2 + ul, .prose h2 + ol { margin-top: 10px; }
`;
