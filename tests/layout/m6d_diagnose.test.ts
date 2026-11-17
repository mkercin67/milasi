import { describe, it } from 'vitest';
import { createEmptyScore, createNote, createPitch } from '../../src/core/factory';
import { layoutScore } from '../../src/layout/layoutScore';
import { renderSvgToString } from '../../src/render/renderSvg';
import { autoSolfege } from '../../src/core/commands';

describe('DIAGNOSE: Barline between measure 4 and 5', () => {
  it('diagnoses layout items and SVG for repeat barlines with real notes', () => {
    // Build an 8-measure score with 2/4 meter and true reference notes
    const score = createEmptyScore({ numMeasures: 8, timeSig: { num: 2, den: 4 } });
    score.meta.title = 'Süt İçtim Dilim Yandı';
    score.meta.composer = 'Müzik Notlarım';

    const p = (step: any, oct = 4) => createPitch(step, oct, 0);
    const n8 = (step: any, oct = 4) => createNote({ pitches: [p(step, oct)], baseType: 'eighth' });
    const n4 = (step: any, oct = 4) => createNote({ pitches: [p(step, oct)], baseType: 'quarter' });

    const measuresData = [
      [n8('D'), n8('E'), n8('F'), n8('G')], // m1
      [n8('F'), n8('G'), n8('G'), n8('G')], // m2
      [n8('F'), n8('G'), n8('G'), n8('G')], // m3
      [n4('F'), n4('E')],                   // m4 (repeatEnd)
      [n8('D'), n8('E'), n8('F'), n8('G')], // m5 (repeatStart)
      [n8('E'), n8('F'), n8('D'), n8('E')], // m6
      [n8('C'), n8('C'), n8('F'), n8('E')], // m7
      [n4('D'), n4('D')],                   // m8 (repeatEnd)
    ];

    for (let i = 0; i < 8; i++) {
      const mId = score.measures[i].id;
      score.parts[0].staves[0].measures[mId].voices[0].events = measuresData[i];
    }

    // Set repeats
    (score.measures[3] as any).repeat = 'end';
    (score.measures[4] as any).repeat = 'start';
    (score.measures[7] as any).repeat = 'end';

    // Apply autoSolfege
    const scoreWithSolfege = autoSolfege(score.id).apply(score);

    // Layout with default container width (typically around 65-80 staff spaces in webview)
    for (const width of [60, 80, 100]) {
      console.log(`\n================== CONTENT WIDTH: ${width} ==================`);
      const layout = layoutScore(scoreWithSolfege, { contentWidth: width });
      console.log('Systems count:', layout.systems.length);

      for (let sIdx = 0; sIdx < layout.systems.length; sIdx++) {
        const sys = layout.systems[sIdx];
        console.log(`\n--- System ${sIdx} (y=${sys.y.toFixed(2)}) ---`);
        for (const it of sys.items) {
          if (it.id.includes('barline') || it.id.includes('repeat')) {
            console.log(
              `  [${it.id}] kind=${it.kind} x=${it.x.toFixed(2)} y=${it.y.toFixed(2)} glyph=${(it as any).glyph}`
            );
          }
        }
      }

      const svg = renderSvgToString(layout);
      const lines = svg.split('\n');
      console.log(`--- SVG snippet (width=${width}) ---`);
      for (const l of lines) {
        if (l.includes('repeat') || (l.includes('barline') && !l.includes('sys-start'))) {
          console.log(l.trim());
        }
      }
    }
  });
});

