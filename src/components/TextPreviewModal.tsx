import React, { useEffect, useState } from 'react';
import {
  X,
  FileText,
  Copy,
  Check,
  Calendar,
  Hash,
  User,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import type { OrderDocumentItem } from '../core/types';

interface TextPreviewModalProps {
  item: OrderDocumentItem | null;
  onClose: () => void;
}

export const TextPreviewModal: React.FC<TextPreviewModalProps> = ({ item, onClose }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!item) return null;

  const handleCopyText = async () => {
    if (!item.extractedText) return;
    try {
      await navigator.clipboard.writeText(item.extractedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const parsed = item.parsed;
  const candidates = parsed?.fioCandidates || [];
  const warnings = parsed?.warnings || [];

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="modal-file-icon">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="modal-title" title={item.originalName}>
                {item.originalName}
              </h3>
              <div className="modal-subtitle">
                <span className="mono">{item.finalFileName}</span>
                {item.usedOcr && (
                  <span className="ocr-badge-pill">
                    <Sparkles size={11} />
                    <span>OCR Tesseract</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body-scroll">
          {/* Metadata Summary Banner */}
          <div className="modal-meta-grid">
            <div className="meta-card">
              <div className="meta-card-label">
                <Hash size={13} />
                <span>Номер приказа</span>
              </div>
              <div className="meta-card-value mono">
                {parsed?.orderNumber || (
                  <span className="meta-missing">Не определен</span>
                )}
              </div>
              {parsed?.orderNumberConfidence && (
                <span
                  className={`meta-confidence conf-${parsed.orderNumberConfidence}`}
                >
                  Точность: {parsed.orderNumberConfidence}
                </span>
              )}
            </div>

            <div className="meta-card">
              <div className="meta-card-label">
                <Calendar size={13} />
                <span>Дата приказа</span>
              </div>
              <div className="meta-card-value mono">
                {parsed?.orderDate || (
                  <span className="meta-missing">Не определена</span>
                )}
              </div>
            </div>

            <div className="meta-card">
              <div className="meta-card-label">
                <User size={13} />
                <span>Выбранное ФИО</span>
              </div>
              <div className="meta-card-value">
                {parsed?.fioNominative || parsed?.fioRaw || (
                  <span className="meta-missing">Не определено</span>
                )}
              </div>
              {parsed?.fioConfidence && (
                <span className={`meta-confidence conf-${parsed.fioConfidence}`}>
                  Точность: {parsed.fioConfidence}
                </span>
              )}
            </div>
          </div>

          {/* Warnings list if any */}
          {warnings.length > 0 && (
            <div className="modal-warnings-box">
              <div className="warnings-title">
                <ShieldAlert size={14} />
                <span>Предупреждения парсера:</span>
              </div>
              <ul className="warnings-list">
                {warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* FIO Candidates Breakdown */}
          {candidates.length > 0 && (
            <div className="modal-section">
              <h4 className="section-title">
                Найденные упоминания персон ({candidates.length})
              </h4>
              <div className="candidates-table-wrap">
                <table className="candidates-table">
                  <thead>
                    <tr>
                      <th>ФИО в тексте</th>
                      <th>Именительный падеж</th>
                      <th>Зона</th>
                      <th>Вес</th>
                      <th>Причина обнаружения</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((cand, idx) => {
                      const isSelected =
                        parsed?.fioRaw === cand.raw ||
                        parsed?.fioNominative === cand.nominative;
                      return (
                        <tr
                          key={idx}
                          className={isSelected ? 'candidate-row-selected' : ''}
                        >
                          <td className="cand-raw-cell">
                            <span>{cand.raw}</span>
                            {isSelected && (
                              <span className="cand-selected-tag">Выбрано</span>
                            )}
                          </td>
                          <td className="mono">{cand.nominative}</td>
                          <td>
                            <span className={`zone-tag zone-${cand.zone}`}>
                              {cand.zone === 'signature'
                                ? 'Подпись'
                                : cand.zone === 'body'
                                ? 'Тело приказа'
                                : 'Шапка'}
                            </span>
                          </td>
                          <td className="mono">{cand.score}</td>
                          <td className="cand-reason-cell">{cand.reason}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Extracted Text Viewer */}
          <div className="modal-section">
            <div className="section-header-row">
              <h4 className="section-title">
                Извлеченный текст ({item.extractedText.length} символов)
              </h4>
              <button
                type="button"
                className="btn btn-sm btn-secondary copy-btn"
                onClick={handleCopyText}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                <span>{copied ? 'Скопировано!' : 'Копировать'}</span>
              </button>
            </div>

            <div className="raw-text-viewer">
              <pre className="raw-text-content mono">
                {item.extractedText || 'Текст не был извлечен'}
              </pre>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};
