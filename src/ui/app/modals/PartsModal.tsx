// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Parts dialog (M7c-6): add, remove, move and rename parts, and group all parts with a bracket or brace.
 * Every action is one undoable command; the dialog keeps no draft state apart from the text being typed.
 */
import React, { useState } from 'react';
import type { Command } from '../../../core/commandTypes';
import { PART_PRESETS } from '../../../core/ensemble';
import { addPart, movePart, removeGroup, removePart, renamePart, setGroup } from '../../../core/ensembleCommands';
import type { Part, Score, StaffGroup } from '../../../core/model';
import { useI18n } from '../../i18n';
import { allPartsGroup } from '../partsDialog';

export interface PartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  score: Score;
  onCommand: (cmd: Command) => void;
}

const button: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  fontSize: '0.8rem',
  borderRadius: '6px',
  border: '1px solid #cbd5e1',
  backgroundColor: '#ffffff',
  color: '#334155',
  cursor: 'pointer',
};
const input: React.CSSProperties = {
  padding: '0.3rem 0.5rem',
  fontSize: '0.85rem',
  border: '1px solid #cbd5e1',
  borderRadius: '6px',
  minWidth: 0,
};

interface PartRowProps {
  part: Part;
  index: number;
  count: number;
  onCommand: (cmd: Command) => void;
}

const PartRow: React.FC<PartRowProps> = ({ part, index, count, onCommand }) => {
  const { t } = useI18n();
  const [name, setName] = useState(part.name);
  const [shortName, setShortName] = useState(part.shortName);
  const commit = () => {
    if (name !== part.name || shortName !== part.shortName) onCommand(renamePart(part.id, name, shortName));
  };
  return (
    <div data-testid={`part-row-${index}`} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
      <input
        aria-label={t('dialog.parts.name')}
        data-testid={`part-name-${index}`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        style={{ ...input, flex: 2 }}
      />
      <input
        aria-label={t('dialog.parts.shortName')}
        data-testid={`part-short-${index}`}
        value={shortName}
        onChange={(e) => setShortName(e.target.value)}
        onBlur={commit}
        style={{ ...input, flex: 1 }}
      />
      <button
        type="button"
        data-testid={`part-up-${index}`}
        title={t('dialog.parts.moveUp')}
        disabled={index === 0}
        onClick={() => onCommand(movePart(part.id, -1))}
        style={button}
      >
        ↑
      </button>
      <button
        type="button"
        data-testid={`part-down-${index}`}
        title={t('dialog.parts.moveDown')}
        disabled={index === count - 1}
        onClick={() => onCommand(movePart(part.id, 1))}
        style={button}
      >
        ↓
      </button>
      <button
        type="button"
        data-testid={`part-remove-${index}`}
        title={t('dialog.parts.remove')}
        disabled={count <= 1}
        onClick={() => onCommand(removePart(part.id))}
        style={button}
      >
        ✕
      </button>
    </div>
  );
};

export const PartsModal: React.FC<PartsModalProps> = ({ isOpen, onClose, score, onCommand }) => {
  const { t } = useI18n();
  const [preset, setPreset] = useState('violin');
  const [bracket, setBracket] = useState<StaffGroup['bracket']>('bracket');
  const [span, setSpan] = useState<StaffGroup['barlineSpan']>('through');
  if (!isOpen) return null;

  const group = allPartsGroup(score);
  const canGroup = score.parts.length > 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="modal-parts"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          padding: '1.5rem',
          width: '560px',
          maxWidth: '92vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>{t('dialog.parts.title')}</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {score.parts.map((p, i) => (
            // The key includes the names so the row restarts after an undo changed them.
            <PartRow key={`${p.id}|${p.name}|${p.shortName}`} part={p} index={i} count={score.parts.length} onCommand={onCommand} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label htmlFor="parts-preset" style={{ fontSize: '0.85rem', color: '#475569' }}>
            {t('dialog.parts.instrument')}
          </label>
          <select
            id="parts-preset"
            data-testid="select-part-preset"
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            style={input}
          >
            {Object.values(PART_PRESETS).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="button" data-testid="btn-add-part" onClick={() => onCommand(addPart(preset))} style={button}>
            + {t('dialog.parts.add')}
          </button>
        </div>

        <fieldset style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.6rem 0.8rem' }} disabled={!canGroup}>
          <legend style={{ fontSize: '0.85rem', color: '#475569', padding: '0 0.3rem' }}>{t('dialog.parts.groupTitle')}</legend>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '0.85rem', color: '#475569' }}>
              {t('dialog.parts.bracket')}{' '}
              <select
                data-testid="select-group-bracket"
                value={bracket}
                onChange={(e) => setBracket(e.target.value as StaffGroup['bracket'])}
                style={input}
              >
                <option value="none">{t('dialog.parts.bracketNone')}</option>
                <option value="bracket">{t('dialog.parts.bracketBracket')}</option>
                <option value="brace">{t('dialog.parts.bracketBrace')}</option>
              </select>
            </label>
            <label style={{ fontSize: '0.85rem', color: '#475569' }}>
              {t('dialog.parts.barlines')}{' '}
              <select
                data-testid="select-group-barlines"
                value={span}
                onChange={(e) => setSpan(e.target.value as StaffGroup['barlineSpan'])}
                style={input}
              >
                <option value="through">{t('dialog.parts.barlinesThrough')}</option>
                <option value="individual">{t('dialog.parts.barlinesIndividual')}</option>
                <option value="mensurstrich">{t('dialog.parts.barlinesMensurstrich')}</option>
              </select>
            </label>
            <button
              type="button"
              data-testid="btn-apply-group"
              onClick={() => onCommand(setGroup(score.parts.map((p) => p.id), bracket, span))}
              style={button}
            >
              {t('dialog.parts.applyGroup')}
            </button>
            {group && (
              <button type="button" data-testid="btn-remove-group" onClick={() => onCommand(removeGroup(group.id))} style={button}>
                {t('dialog.parts.removeGroup')}
              </button>
            )}
          </div>
        </fieldset>

        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{t('dialog.parts.hint')}</span>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" data-testid="btn-close-parts" onClick={onClose} style={{ ...button, padding: '0.45rem 0.9rem' }}>
            {t('dialog.parts.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
