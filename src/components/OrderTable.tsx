import React, { useState, useMemo } from 'react';
import {
  Eye,
  Download,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Loader2,
  XCircle,
  Search,
  Filter,
  UserCheck,
} from 'lucide-react';
import type { OrderDocumentItem, FioCandidate } from '../core/types';
import { formatFioInitial } from '../core/fioDeclension';

interface OrderTableProps {
  items: OrderDocumentItem[];
  onUpdateNumber: (id: string, newNumber: string) => void;
  onUpdateFio: (id: string, newFio: string) => void;
  onSelectCandidate: (id: string, candidate: FioCandidate) => void;
  onRemoveItem: (id: string) => void;
  onPreviewText: (item: OrderDocumentItem) => void;
  onDownloadItem: (item: OrderDocumentItem) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Б';
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getExtBadgeColor(ext: string): { bg: string; color: string } {
  const normalized = ext.toLowerCase().replace('.', '');
  switch (normalized) {
    case 'docx':
    case 'doc':
      return { bg: '#EFF6FF', color: '#1D4ED8' }; // blue
    case 'pdf':
      return { bg: '#FEF2F2', color: '#DC2626' }; // red
    case 'rtf':
      return { bg: '#FAF5FF', color: '#7E22CE' }; // purple
    case 'odt':
      return { bg: '#FFF7ED', color: '#C2410C' }; // orange
    case 'txt':
      return { bg: '#F1F5F9', color: '#475569' }; // slate
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp':
      return { bg: '#ECFDF5', color: '#047857' }; // emerald
    default:
      return { bg: '#F3F4F6', color: '#374151' };
  }
}

export const OrderTable: React.FC<OrderTableProps> = ({
  items,
  onUpdateNumber,
  onUpdateFio,
  onSelectCandidate,
  onRemoveItem,
  onPreviewText,
  onDownloadItem,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'needs_review' | 'ready'>('all');

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Status filter
      if (statusFilter === 'needs_review' && item.status !== 'needs_review') return false;
      if (statusFilter === 'ready' && item.status !== 'ready') return false;

      // Search query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.originalName.toLowerCase().includes(q) ||
        item.editedNumber.toLowerCase().includes(q) ||
        item.editedFio.toLowerCase().includes(q) ||
        item.finalFileName.toLowerCase().includes(q)
      );
    });
  }, [items, searchQuery, statusFilter]);

  const reviewCount = useMemo(
    () => items.filter((it) => it.status === 'needs_review').length,
    [items]
  );
  const readyCount = useMemo(
    () => items.filter((it) => it.status === 'ready').length,
    [items]
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="order-table-container">
      {/* Table toolbar: search & filter pills */}
      <div className="table-toolbar">
        <div className="table-search-box">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            placeholder="Поиск по файлу, номеру или ФИО..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
            >
              ×
            </button>
          )}
        </div>

        <div className="table-filter-pills">
          <button
            type="button"
            className={`filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            Все ({items.length})
          </button>
          {reviewCount > 0 && (
            <button
              type="button"
              className={`filter-pill review-pill ${statusFilter === 'needs_review' ? 'active' : ''}`}
              onClick={() => setStatusFilter('needs_review')}
            >
              <AlertTriangle size={13} />
              <span>Уточнить ({reviewCount})</span>
            </button>
          )}
          <button
            type="button"
            className={`filter-pill ${statusFilter === 'ready' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ready')}
          >
            <CheckCircle size={13} />
            <span>Готово ({readyCount})</span>
          </button>
        </div>
      </div>

      {/* Main Table view */}
      <div className="table-scroll-wrapper">
        <table className="order-table">
          <thead>
            <tr>
              <th className="th-file">Исходный файл</th>
              <th className="th-status">Статус</th>
              <th className="th-number">Номер приказа</th>
              <th className="th-fio">ФИО сотрудника</th>
              <th className="th-preview">Новое имя файла</th>
              <th className="th-actions">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const extBadge = getExtBadgeColor(item.extension);
              const candidates = item.parsed?.fioCandidates || [];
              const hasMultipleCandidates = candidates.length > 1;

              return (
                <tr key={item.id} className={`order-row status-${item.status}`}>
                  {/* Column 1: File info */}
                  <td className="td-file">
                    <div className="file-cell">
                      <span
                        className="ext-badge"
                        style={{ backgroundColor: extBadge.bg, color: extBadge.color }}
                      >
                        {item.extension.toUpperCase().replace('.', '') || 'FILE'}
                      </span>
                      <div className="file-meta">
                        <span className="file-name" title={item.originalName}>
                          {item.originalName}
                        </span>
                        <div className="file-submeta">
                          <span className="file-size">{formatBytes(item.size)}</span>
                          {item.usedOcr && (
                            <span className="ocr-indicator" title="Текст распознан через OCR">
                              OCR
                            </span>
                          )}
                          {item.parsed?.orderDate && (
                            <span className="date-indicator">
                              {item.parsed.orderDate}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Column 2: Status */}
                  <td className="td-status">
                    {item.status === 'processing' && (
                      <span className="status-badge status-processing">
                        <Loader2 size={13} className="spin" />
                        <span>{item.progressText || 'Обработка...'}</span>
                      </span>
                    )}
                    {item.status === 'ready' && (
                      <span className="status-badge status-ready">
                        <CheckCircle size={13} />
                        <span>Готово</span>
                      </span>
                    )}
                    {item.status === 'needs_review' && (
                      <span
                        className="status-badge status-review"
                        title={item.errorMessage || 'Проверьте номер или ФИО'}
                      >
                        <AlertTriangle size={13} />
                        <span>Уточнить</span>
                      </span>
                    )}
                    {item.status === 'error' && (
                      <span
                        className="status-badge status-error"
                        title={item.errorMessage || 'Не удалось обработать файл'}
                      >
                        <XCircle size={13} />
                        <span>Ошибка</span>
                      </span>
                    )}
                  </td>

                  {/* Column 3: Editable Order Number */}
                  <td className="td-number">
                    <div className="number-input-group">
                      <input
                        type="text"
                        value={item.editedNumber}
                        onChange={(e) => onUpdateNumber(item.id, e.target.value)}
                        placeholder="Номер (напр. 650 ПР)"
                        className={`table-input number-input mono ${
                          !item.editedNumber ? 'input-warning' : ''
                        }`}
                        title="Нажмите, чтобы отредактировать номер приказа"
                      />
                    </div>
                  </td>

                  {/* Column 4: Editable FIO + Candidate Switcher */}
                  <td className="td-fio">
                    <div className="fio-cell-content">
                      <input
                        type="text"
                        value={item.editedFio}
                        onChange={(e) => onUpdateFio(item.id, e.target.value)}
                        placeholder="ФИО сотрудника"
                        className={`table-input fio-input ${
                          !item.editedFio ? 'input-warning' : ''
                        }`}
                        title="Нажмите, чтобы отредактировать ФИО"
                      />

                      {/* 1-click Candidate Switcher if multiple names detected */}
                      {hasMultipleCandidates && (
                        <div className="candidates-quick-switch">
                          <span className="candidates-label" title="Найдены другие варианты ФИО в документе">
                            <UserCheck size={11} />
                            <span>Кандидаты:</span>
                          </span>
                          <div className="candidate-chips-scroll">
                            {candidates.map((cand, idx) => {
                              const isSelected =
                                item.editedFio.includes(cand.nominative) ||
                                item.editedFio.includes(cand.shortNominative) ||
                                item.editedFio === cand.nominative ||
                                item.editedFio === cand.shortNominative ||
                                item.editedFio === formatFioInitial(cand.nominative);

                              const roleLabel =
                                cand.zone === 'signature'
                                  ? 'Руководитель'
                                  : cand.zone === 'body'
                                  ? 'Сотрудник'
                                  : 'Шапка';

                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  className={`candidate-chip ${isSelected ? 'selected' : ''}`}
                                  onClick={() => onSelectCandidate(item.id, cand)}
                                  title={`${cand.raw} (${roleLabel}, ${cand.reason})`}
                                >
                                  <span className="cand-name">{cand.shortNominative || cand.nominative}</span>
                                  <span className="cand-zone">{roleLabel}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Column 5: Live Final Filename Preview */}
                  <td className="td-preview">
                    <div className="preview-filename-cell">
                      <span className="final-filename-text mono" title={item.finalFileName}>
                        {renderHighlightedFileName(item.finalFileName, item.hasCollisionSuffix)}
                      </span>
                    </div>
                  </td>

                  {/* Column 6: Action Buttons */}
                  <td className="td-actions">
                    <div className="row-actions-group">
                      <button
                        type="button"
                        className="action-btn"
                        onClick={() => onPreviewText(item)}
                        title="Просмотр извлеченного текста и метаданных"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        type="button"
                        className="action-btn action-download"
                        onClick={() => onDownloadItem(item)}
                        title="Скачать переименованный файл"
                      >
                        <Download size={15} />
                      </button>
                      <button
                        type="button"
                        className="action-btn action-delete"
                        onClick={() => onRemoveItem(item.id)}
                        title="Удалить из списка"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredItems.length === 0 && (
        <div className="table-empty-filtered">
          <Filter size={20} className="empty-icon" />
          <span>Нет файлов, соответствующих условиям фильтра</span>
        </div>
      )}
    </div>
  );
};

/**
 * Highlights collision suffixes like (1), (2) or fallback tags like [без номера]
 */
function renderHighlightedFileName(fileName: string, hasCollision: boolean) {
  // Check for collision pattern e.g. " 2." or " 3."
  const collisionRegex = /( \d+)(?=\.[^.]+$)/;
  const missingRegex = /(\[без [^\]]+\])/g;

  if (hasCollision && collisionRegex.test(fileName)) {
    const parts = fileName.split(collisionRegex);
    return (
      <>
        {parts[0]}
        <span className="collision-badge">{parts[1]}</span>
        {parts.slice(2).join('')}
      </>
    );
  }

  if (missingRegex.test(fileName)) {
    const segments = fileName.split(missingRegex);
    return segments.map((seg, i) =>
      seg.startsWith('[без ') ? (
        <span key={i} className="missing-badge">
          {seg}
        </span>
      ) : (
        seg
      )
    );
  }

  return fileName;
}
