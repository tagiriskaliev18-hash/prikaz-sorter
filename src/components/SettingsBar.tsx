import React, { useRef } from 'react';
import { Sliders, HelpCircle, Check } from 'lucide-react';
import type { NamingSettings, FioFormatMode } from '../core/types';
import { TEMPLATE_PRESETS } from '../core/renamer';

interface SettingsBarProps {
  settings: NamingSettings;
  onChange: (newSettings: NamingSettings) => void;
}

const VARIABLE_CHIPS: Array<{ tag: string; label: string; desc: string }> = [
  { tag: '{number}', label: '{номер}', desc: 'Номер приказа (напр. 142-к)' },
  { tag: '{fio}', label: '{фио}', desc: 'ФИО сотрудника в выбранном формате' },
  { tag: '{date}', label: '{дата}', desc: 'Дата приказа (ДД.ММ.ГГГГ)' },
  { tag: '{orig}', label: '{исходное}', desc: 'Исходное имя файла без расширения' },
];

export const SettingsBar: React.FC<SettingsBarProps> = ({ settings, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const presets = Array.isArray(TEMPLATE_PRESETS) ? TEMPLATE_PRESETS : [];

  const handlePresetClick = (template: string) => {
    onChange({ ...settings, template });
  };

  const handleChipClick = (tag: string) => {
    const input = inputRef.current;
    if (!input) {
      onChange({ ...settings, template: settings.template + '_' + tag });
      return;
    }

    const start = input.selectionStart ?? settings.template.length;
    const end = input.selectionEnd ?? settings.template.length;
    const current = settings.template;
    const updated = current.substring(0, start) + tag + current.substring(end);

    onChange({ ...settings, template: updated });

    // Restore focus and cursor position after insertion
    requestAnimationFrame(() => {
      input.focus();
      const newPos = start + tag.length;
      input.setSelectionRange(newPos, newPos);
    });
  };

  const handleFioFormatChange = (mode: FioFormatMode) => {
    onChange({ ...settings, fioFormat: mode });
  };

  const handleSlashChange = (slashReplacement: '-' | '_' | '') => {
    onChange({ ...settings, slashReplacement });
  };

  const handleNormalizeToggle = () => {
    onChange({ ...settings, normalizeFioCase: !settings.normalizeFioCase });
  };

  return (
    <div className="settings-workbench-card">
      <div className="settings-header">
        <div className="settings-title-group">
          <Sliders size={16} className="settings-icon" />
          <span className="settings-title">Правила переименования</span>
        </div>
        <div className="settings-quick-preview">
          <span className="preview-label">Шаблон:</span>
          <code className="preview-code">{settings.template}</code>
        </div>
      </div>

      <div className="settings-grid">
        {/* Row 1: Presets & Template Editor */}
        <div className="settings-field full-width">
          <label className="field-label">
            <span>Шаблон имени файла</span>
            <span className="field-help" title="Используйте переменные {number}, {fio}, {date}, {orig}">
              <HelpCircle size={13} />
            </span>
          </label>

          <div className="preset-pills-row">
            {presets.map((preset) => {
              const isActive = settings.template === preset.template;
              return (
                <button
                  key={preset.id || preset.label}
                  type="button"
                  className={`preset-pill ${isActive ? 'active' : ''}`}
                  onClick={() => handlePresetClick(preset.template)}
                >
                  {isActive && <Check size={12} className="pill-check" />}
                  <span>{preset.label}</span>
                </button>
              );
            })}
          </div>

          <div className="template-input-wrapper">
            <input
              ref={inputRef}
              type="text"
              value={settings.template}
              onChange={(e) => onChange({ ...settings, template: e.target.value })}
              className="template-text-input mono"
              placeholder="{number}_{fio}"
            />
            <div className="variable-chips-container">
              <span className="chips-hint">Вставить:</span>
              {VARIABLE_CHIPS.map((chip) => (
                <button
                  key={chip.tag}
                  type="button"
                  className="chip-btn"
                  onClick={() => handleChipClick(chip.tag)}
                  title={chip.desc}
                >
                  {chip.tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 2: FIO formatting options */}
        <div className="settings-field">
          <label className="field-label">Формат ФИО в имени</label>
          <div className="segmented-control">
            <button
              type="button"
              className={`segmented-item ${settings.fioFormat === 'short' ? 'active' : ''}`}
              onClick={() => handleFioFormatChange('short')}
              title="Пример: Смирнов А.Д."
            >
              Фамилия И.О.
            </button>
            <button
              type="button"
              className={`segmented-item ${settings.fioFormat === 'full' ? 'active' : ''}`}
              onClick={() => handleFioFormatChange('full')}
              title="Пример: Смирнов Алексей Дмитриевич"
            >
              Полное ФИО
            </button>
            <button
              type="button"
              className={`segmented-item ${settings.fioFormat === 'surname' ? 'active' : ''}`}
              onClick={() => handleFioFormatChange('surname')}
              title="Пример: Смирнов"
            >
              Только фамилия
            </button>
          </div>
        </div>

        {/* Row 3: Slash replacement */}
        <div className="settings-field">
          <label className="field-label">Замена слэша в номере (напр. 142/к)</label>
          <div className="segmented-control">
            <button
              type="button"
              className={`segmented-item ${settings.slashReplacement === '-' ? 'active' : ''}`}
              onClick={() => handleSlashChange('-')}
              title="Заменять / на дефис: 142-к"
            >
              Дефис (-)
            </button>
            <button
              type="button"
              className={`segmented-item ${settings.slashReplacement === '_' ? 'active' : ''}`}
              onClick={() => handleSlashChange('_')}
              title="Заменять / на подчеркивание: 142_к"
            >
              Подчеркивание (_)
            </button>
            <button
              type="button"
              className={`segmented-item ${settings.slashReplacement === '' ? 'active' : ''}`}
              onClick={() => handleSlashChange('')}
              title="Удалять слэш: 142к"
            >
              Убрать
            </button>
          </div>
        </div>

        {/* Row 4: Case Normalization Toggle */}
        <div className="settings-field toggle-field">
          <label className="toggle-container" onClick={handleNormalizeToggle}>
            <div className={`switch-track ${settings.normalizeFioCase ? 'checked' : ''}`}>
              <div className="switch-thumb" />
            </div>
            <div className="toggle-text-group">
              <span className="toggle-title">Приводить ФИО к именительному падежу</span>
              <span className="toggle-subtitle">
                Например: «Коваленко Ольге» → «Коваленко Ольга»
              </span>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
};
