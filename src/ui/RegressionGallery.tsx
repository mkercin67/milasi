// SPDX-License-Identifier: GPL-3.0-or-later
import React, { useMemo, useState } from 'react';
import { GalleryCase, getGalleryCases } from './galleryCases';
import { getPolyphonyGalleryCards } from './polyphonyBuilders';
import { Score } from '../core/model';
import { LayoutResult } from '../layout/types';
import { layoutScore } from '../layout/layoutScore';
import { renderSvgToString } from '../render/renderSvg';

interface RenderedGalleryCase extends GalleryCase {
  score: Score;
  layout: LayoutResult;
  svgHtml: string;
  tag?: string;
  notesChecklist?: string[];
  multiWidthSvgs?: Array<{ label: string; svg: string }>;
}

export const RegressionGallery: React.FC = () => {
  const cases = useMemo(() => getGalleryCases(), []);
  const polyCards = useMemo(() => getPolyphonyGalleryCards(), []);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('all');

  const renderedCases = useMemo((): RenderedGalleryCase[] => {
    const standardCases: RenderedGalleryCase[] = cases.map((c) => {
      const score = c.build();
      const layout = layoutScore(score, { width: 70 });
      const svgHtml = renderSvgToString(layout, { staffSpacePx: 10, score, responsive: !c.fixedSize });

      if (c.id === 'wrapping-three-widths') {
        const layout385 = layoutScore(score, { width: 38.5 });
        const layout600 = layoutScore(score, { width: 60 });
        const layout1200 = layoutScore(score, { width: 120 });
        const svg385 = renderSvgToString(layout385, { staffSpacePx: 10, score });
        const svg600 = renderSvgToString(layout600, { staffSpacePx: 10, score });
        const svg1200 = renderSvgToString(layout1200, { staffSpacePx: 10, score });
        return {
          ...c,
          score,
          layout,
          svgHtml,
          multiWidthSvgs: [
            { label: '385 px (Narrow / Mobile)', svg: svg385 },
            { label: '600 px (Medium / Tablet)', svg: svg600 },
            { label: '1200 px (Wide / Desktop)', svg: svg1200 },
          ],
        };
      }

      return {
        ...c,
        score,
        layout,
        svgHtml,
      };
    });

    const polyCases: RenderedGalleryCase[] = polyCards.map((pc) => {
      const score = pc.build();
      const layout = layoutScore(score, { width: pc.id === 'poly-9-bwv-140-reduction-whole-fixture' ? 140 : 70 });
      const svgHtml = renderSvgToString(layout, { staffSpacePx: 10, score, responsive: true });
      return {
        id: pc.id,
        title: pc.title,
        description: pc.description,
        tag: pc.tag,
        notesChecklist: pc.notesChecklist,
        build: pc.build,
        score,
        layout,
        svgHtml,
      };
    });

    return [...standardCases, ...polyCases];
  }, [cases, polyCards]);

  const displayedCases = selectedCaseId === 'all'
    ? renderedCases
    : renderedCases.filter((c) => c.id === selectedCaseId);

  return (
    <div
      data-testid="regression-gallery"
      style={{
        padding: '2rem',
        backgroundColor: '#f8fafc',
        minHeight: '100vh',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        color: '#0f172a',
      }}
    >
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
          MiLaSi Notation Regression Gallery
        </h1>
        <p style={{ color: '#64748b', margin: '0 0 1rem 0' }}>
          Standard notation test cases built exclusively through score commands.
        </p>

        {/* Filter buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setSelectedCaseId('all')}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: selectedCaseId === 'all' ? '#2563eb' : '#ffffff',
              color: selectedCaseId === 'all' ? '#ffffff' : '#334155',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            All Cases
          </button>
          {cases.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCaseId(c.id)}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: selectedCaseId === c.id ? '#2563eb' : '#ffffff',
                color: selectedCaseId === c.id ? '#ffffff' : '#334155',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              {c.title}
            </button>
          ))}
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: selectedCaseId === 'all' ? 'repeat(auto-fit, minmax(560px, 1fr))' : '1fr',
          gap: '2rem',
        }}
      >
        {displayedCases.map((c) => (
          <div
            key={c.id}
            data-testid={`gallery-case-${c.id}`}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.06)',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              gridColumn: (selectedCaseId === 'all' && c.id === 'poly-9-bwv-140-reduction-whole-fixture') ? '1 / -1' : undefined,
            }}
          >
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0 }}>
                  {c.title}
                </h2>
                {c.tag && (
                  <span
                    data-testid={`gallery-tag-${c.id}`}
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: c.tag.includes('OBSERVED') ? '#dcfce7' : '#e0e7ff',
                      color: c.tag.includes('OBSERVED') ? '#15803d' : '#4338ca',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1',
                    }}
                  >
                    {c.tag}
                  </span>
                )}
                {c.pending && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: '#fef3c7',
                      color: '#b45309',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px',
                      border: '1px solid #fde68a',
                    }}
                  >
                    Pending M7a
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
                {c.description}
              </p>
            </div>

            {c.multiWidthSvgs ? (
              <div
                style={{
                  display: 'flex',
                  gap: '1.5rem',
                  overflowX: 'auto',
                  padding: '0.5rem 0',
                }}
              >
                {c.multiWidthSvgs.map((mw) => (
                  <div
                    key={mw.label}
                    style={{
                      flex: '1 1 0',
                      minWidth: '320px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #f1f5f9',
                      borderRadius: '8px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>
                      {mw.label}
                    </div>
                    <div style={{ overflowX: 'auto' }} dangerouslySetInnerHTML={{ __html: mw.svg }} />
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #f1f5f9',
                  borderRadius: '8px',
                  padding: '1rem',
                  overflowX: 'auto',
                }}
                dangerouslySetInnerHTML={{ __html: c.svgHtml }}
              />
            )}

            {c.notesChecklist && (
              <div
                data-testid={`notes-checklist-${c.id}`}
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem 1rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                }}
              >
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.4rem' }}>
                  Reference Measure Checklist (BWV 140/7):
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.25rem' }}>
                  {c.notesChecklist.map((item, idx) => (
                    <div key={idx} style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#475569' }}>
                      [ ] {item}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
