import React, { useMemo, useState } from 'react';
import { getGalleryCases } from './galleryCases';
import { layoutScore } from '../layout/layoutScore';
import { renderSvgToString } from '../render/renderSvg';

export const RegressionGallery: React.FC = () => {
  const cases = useMemo(() => getGalleryCases(), []);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('all');

  const renderedCases = useMemo(() => {
    return cases.map((c) => {
      const score = c.build();
      const layout = layoutScore(score, { width: 70 });
      const svgHtml = renderSvgToString(layout, { staffSpacePx: 10 });
      return {
        ...c,
        score,
        layout,
        svgHtml,
      };
    });
  }, [cases]);

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
          ScoreForge Notation Regression Gallery
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
            }}
          >
            <div style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>
                {c.title}
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
                {c.description}
              </p>
            </div>

            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #f1f5f9',
                borderRadius: '8px',
                padding: '1rem',
                overflowX: 'auto',
                display: 'flex',
                justifyContent: 'center',
              }}
              dangerouslySetInnerHTML={{ __html: c.svgHtml }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
