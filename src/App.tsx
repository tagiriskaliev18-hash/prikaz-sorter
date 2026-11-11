import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  FileCheck,
  Shield,
  Download,
  FolderDown,
  Trash2,
  Plus,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import type { OrderDocumentItem, NamingSettings, FioCandidate, DocumentItemStatus } from './core/types';
import { extractTextFromFile, detectExtension } from './core/extractors';
import { parseOrderText } from './core/orderParser';
import {
  DEFAULT_NAMING_SETTINGS,
  formatFioBySettings,
  resolveBatchFileNames,
} from './core/renamer';

function applyBatchRenames(
  items: OrderDocumentItem[],
  namingSettings: NamingSettings,
): OrderDocumentItem[] {
  const resolved = resolveBatchFileNames(items, namingSettings);
  return items.map((item, idx) => ({
    ...item,
    finalFileName: resolved[idx]?.finalFileName ?? item.finalFileName,
    hasCollisionSuffix: resolved[idx]?.hasCollisionSuffix ?? false,
  }));
}
import { createDemoOrderFiles } from './utils/demoOrders';
import {
  downloadSingleFile,
  downloadAllAsZip,
  supportsDirectorySave,
  saveAllToDirectory,
} from './utils/download';
import { DropZone } from './components/DropZone';
import { SettingsBar } from './components/SettingsBar';
import { OrderTable } from './components/OrderTable';
import { TextPreviewModal } from './components/TextPreviewModal';

export const App: React.FC = () => {
  const [items, setItems] = useState<OrderDocumentItem[]>([]);
  const [settings, setSettings] = useState<NamingSettings>(DEFAULT_NAMING_SETTINGS);
  const [activePreviewItem, setActivePreviewItem] = useState<OrderDocumentItem | null>(null);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [isSavingToDir, setIsSavingToDir] = useState(false);
  const [notification, setNotification] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);

  // Hidden file input for "Add more files" button
  const addFilesInputRef = useRef<HTMLInputElement>(null);

  const canSaveDirectory = supportsDirectorySave();

  // Show auto-dismissing notifications
  const showNotification = useCallback(
    (type: 'success' | 'info' | 'error', message: string, durationMs = 4000) => {
      setNotification({ type, message });
      setTimeout(() => {
        setNotification((prev) => (prev?.message === message ? null : prev));
      }, durationMs);
    },
    []
  );

  // Process a single file through extractor, parser, and renamer
  const processDocumentItem = useCallback(
    async (
      initialItem: OrderDocumentItem,
      currentSettings: NamingSettings,
      updateItem: (updater: (prev: OrderDocumentItem) => OrderDocumentItem) => void
    ) => {
      try {
        const extraction = await extractTextFromFile(initialItem.file, (progress) => {
          updateItem((prev) => ({
            ...prev,
            progressText: progress,
          }));
        });

        const parsed = parseOrderText(extraction.text);

        const initialNumber = parsed.orderNumber || '';
        const initialFio = formatFioBySettings(
          parsed.fioRaw ?? '',
          parsed.fioNominative ?? '',
          currentSettings
        );

        // Assess review status
        const isReady =
          parsed.orderNumberConfidence === 'high' &&
          (parsed.fioConfidence === 'high' || parsed.fioConfidence === 'medium') &&
          initialNumber.length > 0 &&
          initialFio.length > 0;

        const newStatus = isReady ? 'ready' : 'needs_review';

        updateItem((prev) => ({
          ...prev,
          status: newStatus,
          progressText: undefined,
          extractedText: extraction.text,
          usedOcr: extraction.usedOcr,
          parsed,
          editedNumber: initialNumber,
          editedFio: initialFio,
          fioManuallyEdited: false,
        }));
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : 'Не удалось обработать документ';
        updateItem((prev) => ({
          ...prev,
          status: 'error',
          progressText: undefined,
          errorMessage,
        }));
      }
    },
    []
  );

  // Add files to the batch and trigger processing
  const handleAddFiles = useCallback(
    async (newFiles: File[]) => {
      if (newFiles.length === 0) return;

      const newItems: OrderDocumentItem[] = newFiles.map((file) => {
        const ext = detectExtension(file.name);
        return {
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          file,
          originalName: file.name,
          extension: ext === 'unknown' ? file.name.split('.').pop() || '' : ext,
          size: file.size,
          status: 'processing',
          progressText: 'В очереди...',
          extractedText: '',
          usedOcr: false,
          parsed: {
            orderNumber: null,
            orderNumberConfidence: 'none',
            orderDate: null,
            fioRaw: null,
            fioNominative: null,
            fioConfidence: 'none',
            fioCandidates: [],
            warnings: [],
          },
          editedNumber: '',
          editedFio: '',
          fioManuallyEdited: false,
          finalFileName: file.name,
          hasCollisionSuffix: false,
        };
      });

      // Append new items and re-resolve filenames
      setItems((prev) => applyBatchRenames([...prev, ...newItems], settings));

      // Process in batches of 2 concurrency for smooth UI
      const queue = [...newItems];
      const concurrency = 2;

      const worker = async () => {
        while (queue.length > 0) {
          const itemToProcess = queue.shift();
          if (!itemToProcess) break;

          await processDocumentItem(itemToProcess, settings, (updater) => {
            setItems((prev) => {
              const updated = prev.map((it) => (it.id === itemToProcess.id ? updater(it) : it));
              return applyBatchRenames(updated, settings);
            });
          });
        }
      };

      const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () =>
        worker()
      );
      await Promise.all(workers);
    },
    [processDocumentItem, settings]
  );

  // Load demo orders
  const handleLoadDemo = useCallback(async () => {
    try {
      setIsLoadingDemo(true);
      const demoFiles = await createDemoOrderFiles();
      await handleAddFiles(demoFiles);
      showNotification('success', 'Загружено 3 демонстрационных приказа (DOCX и RTF)');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка при создании демо-файлов';
      showNotification('error', msg);
    } finally {
      setIsLoadingDemo(false);
    }
  }, [handleAddFiles, showNotification]);

  // Update Settings and recompute FIO and filenames reactively
  const handleSettingsChange = useCallback(
    (newSettings: NamingSettings) => {
      setSettings(newSettings);
      setItems((prev) => {
        const updated = prev.map((item) => {
          // If user didn't manually customize this item's FIO, reformat according to new settings
          if (!item.fioManuallyEdited && item.parsed) {
            const reformattedFio = formatFioBySettings(
              item.parsed.fioRaw ?? '',
              item.parsed.fioNominative ?? '',
              newSettings
            );
            return {
              ...item,
              editedFio: reformattedFio,
            };
          }
          return item;
        });
        return applyBatchRenames(updated, newSettings);
      });
    },
    []
  );

  // Edit Order Number
  const handleUpdateNumber = useCallback(
    (id: string, newNumber: string) => {
      setItems((prev) => {
        const updated = prev.map((item): OrderDocumentItem => {
          if (item.id === id) {
            const hasFio = Boolean(item.editedFio.trim());
            const hasNum = Boolean(newNumber.trim());
            const newStatus: DocumentItemStatus =
              item.status === 'processing'
                ? item.status
                : hasFio && hasNum
                ? 'ready'
                : 'needs_review';
            return {
              ...item,
              editedNumber: newNumber,
              status: newStatus,
            };
          }
          return item;
        });
        return applyBatchRenames(updated, settings);
      });
    },
    [settings]
  );

  // Edit FIO manually
  const handleUpdateFio = useCallback(
    (id: string, newFio: string) => {
      setItems((prev) => {
        const updated = prev.map((item): OrderDocumentItem => {
          if (item.id === id) {
            const hasFio = Boolean(newFio.trim());
            const hasNum = Boolean(item.editedNumber.trim());
            const newStatus: DocumentItemStatus =
              item.status === 'processing'
                ? item.status
                : hasFio && hasNum
                ? 'ready'
                : 'needs_review';
            return {
              ...item,
              editedFio: newFio,
              fioManuallyEdited: true,
              status: newStatus,
            };
          }
          return item;
        });
        return applyBatchRenames(updated, settings);
      });
    },
    [settings]
  );

  // Select Candidate FIO from suggestions
  const handleSelectCandidate = useCallback(
    (id: string, candidate: FioCandidate) => {
      setItems((prev) => {
        const updated = prev.map((item): OrderDocumentItem => {
          if (item.id === id) {
            const formatted = formatFioBySettings(
              candidate.raw,
              candidate.nominative,
              settings
            );
            const hasNum = Boolean(item.editedNumber.trim());
            const newStatus: DocumentItemStatus = hasNum ? 'ready' : 'needs_review';
            return {
              ...item,
              editedFio: formatted,
              fioManuallyEdited: true,
              status: newStatus,
            };
          }
          return item;
        });
        return applyBatchRenames(updated, settings);
      });
    },
    [settings]
  );

  // Remove single item
  const handleRemoveItem = useCallback(
    (id: string) => {
      setItems((prev) => {
        const updated = prev.filter((it) => it.id !== id);
        return applyBatchRenames(updated, settings);
      });
    },
    [settings]
  );

  // Clear all
  const handleClearAll = useCallback(() => {
    if (items.length > 0) {
      if (window.confirm('Очистить список документов?')) {
        setItems([]);
      }
    }
  }, [items.length]);

  // Download single file
  const handleDownloadSingle = useCallback((item: OrderDocumentItem) => {
    downloadSingleFile(item.file, item.finalFileName);
  }, []);

  // Download all as ZIP
  const handleDownloadAllZip = useCallback(async () => {
    if (items.length === 0) return;
    try {
      setIsDownloadingZip(true);
      await downloadAllAsZip(items);
      showNotification('success', `Скачан ZIP-архив с ${items.length} файлами`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка при создании архива';
      showNotification('error', msg);
    } finally {
      setIsDownloadingZip(false);
    }
  }, [items, showNotification]);

  // Save directly to folder via File System Access API
  const handleSaveToDirectory = useCallback(async () => {
    if (items.length === 0) return;
    try {
      setIsSavingToDir(true);
      const count = await saveAllToDirectory(items);
      showNotification('success', `Успешно сохранено файлов в папку: ${count}`);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User canceled directory picker dialog - no alert needed
        return;
      }
      const msg = err instanceof Error ? err.message : 'Не удалось сохранить файлы в папку';
      showNotification('error', msg);
    } finally {
      setIsSavingToDir(false);
    }
  }, [items, showNotification]);

  // Keep activePreviewItem in sync with items
  useEffect(() => {
    if (activePreviewItem) {
      const fresh = items.find((it) => it.id === activePreviewItem.id);
      if (fresh) {
        setActivePreviewItem(fresh);
      }
    }
  }, [items, activePreviewItem]);

  // Stats calculation
  const totalCount = items.length;
  const readyCount = items.filter((it) => it.status === 'ready').length;
  const reviewCount = items.filter((it) => it.status === 'needs_review').length;
  const processingCount = items.filter((it) => it.status === 'processing').length;

  return (
    <div className="app-container">
      {/* Toast Notification Banner */}
      {notification && (
        <div className={`notification-toast toast-${notification.type}`}>
          {notification.type === 'success' && <CheckCircle2 size={16} />}
          {notification.type === 'error' && <AlertCircle size={16} />}
          {notification.type === 'info' && <Info size={16} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Top Application Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="brand-mark">
            <div className="brand-icon-box">
              <FileCheck size={22} className="brand-icon" />
            </div>
            <div className="brand-text">
              <h1 className="brand-title">ПриказСорт</h1>
              <span className="brand-tagline">
                Мгновенное пакетное переименование приказов
              </span>
            </div>
          </div>
        </div>

        <div className="header-center">
          <div className="privacy-badge-pill" title="Ни один байт ваших документов не отправляется в сеть">
            <Shield size={14} className="privacy-badge-icon" />
            <span className="privacy-badge-text">
              100% офлайн в браузере: файлы не передаются на сервер
            </span>
          </div>
        </div>

        <div className="header-right">
          {totalCount > 0 && (
            <div className="stats-counter-strip">
              <div className="stat-pill" title="Всего документов в очереди">
                <span className="stat-label">Всего:</span>
                <span className="stat-value">{totalCount}</span>
              </div>
              <div className="stat-pill stat-ready" title="Готовы к сохранению">
                <span className="stat-label">Готово:</span>
                <span className="stat-value">{readyCount}</span>
              </div>
              {reviewCount > 0 && (
                <div className="stat-pill stat-review" title="Требуется проверка">
                  <span className="stat-label">Уточнить:</span>
                  <span className="stat-value">{reviewCount}</span>
                </div>
              )}
              {processingCount > 0 && (
                <div className="stat-pill stat-processing" title="Идет извлечение">
                  <span className="stat-label">В работе:</span>
                  <span className="stat-value">{processingCount}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Workbench Body */}
      <main className="workbench-main">
        {/* Settings Configuration Bar */}
        <SettingsBar settings={settings} onChange={handleSettingsChange} />

        {/* Hero DropZone (when empty) OR Compact Add Bar + Table (when items loaded) */}
        {totalCount === 0 ? (
          <div className="empty-workspace-view">
            <DropZone
              onFilesSelected={handleAddFiles}
              onLoadDemo={handleLoadDemo}
              isLoadingDemo={isLoadingDemo}
            />

            {/* Feature Highlights Grid */}
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon-wrapper">
                  <FileCheck size={18} />
                </div>
                <h4 className="feature-title">Умный поиск номера и ФИО</h4>
                <p className="feature-desc">
                  Распознает «Приказ № 142-к», «Бұйрық № 87-ж/қ», выявляет ФИО в любых
                  падежах («Смирнова Алексея», «Сулейменовой Айгуль») и приводит к именительному.
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon-wrapper">
                  <Sparkles size={18} />
                </div>
                <h4 className="feature-title">Все офисные форматы + OCR</h4>
                <p className="feature-desc">
                  Поддерживает DOCX, PDF (включая сканированные через встроенный Tesseract
                  OCR), RTF с кодировками Win-1251, ODT и TXT.
                </p>
              </div>

              <div className="feature-card">
                <div className="feature-icon-wrapper">
                  <Shield size={18} />
                </div>
                <h4 className="feature-title">Полная приватность кадровых данных</h4>
                <p className="feature-desc">
                  Никаких утечек персональных данных (ПДн) и отправки в облако. Все вычисления,
                  парсинг и сохранение происходят локально в браузере на вашем ПК.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="workbench-active-view">
            {/* Batch Action Toolbar */}
            <div className="batch-actions-bar">
              <div className="batch-actions-left">
                <input
                  ref={addFilesInputRef}
                  type="file"
                  multiple
                  accept=".docx,.pdf,.rtf,.txt,.odt,.doc,.png,.jpg,.jpeg,.webp"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleAddFiles(Array.from(e.target.files));
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => addFilesInputRef.current?.click()}
                  title="Добавить файлы в текущую партию"
                >
                  <Plus size={16} />
                  <span>Добавить файлы</span>
                </button>

                <button
                  type="button"
                  className="btn btn-demo-compact"
                  onClick={handleLoadDemo}
                  disabled={isLoadingDemo}
                  title="Добавить 3 синтетических демо-приказа"
                >
                  <Sparkles size={15} />
                  <span>{isLoadingDemo ? 'Создание...' : '+ Демо-приказы'}</span>
                </button>
              </div>

              <div className="batch-actions-right">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleDownloadAllZip}
                  disabled={isDownloadingZip || totalCount === 0}
                  title="Скачать все файлы единым ZIP-архивом"
                >
                  <Download size={16} />
                  <span>
                    {isDownloadingZip
                      ? 'Упаковка ZIP...'
                      : `Скачать архив .zip (${totalCount})`}
                  </span>
                </button>

                {canSaveDirectory && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-save-dir"
                    onClick={handleSaveToDirectory}
                    disabled={isSavingToDir || totalCount === 0}
                    title="Выбрать папку на диске и записать переименованные файлы напрямую"
                  >
                    <FolderDown size={16} />
                    <span>
                      {isSavingToDir ? 'Запись в папку...' : 'Сохранить в папку'}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  className="btn btn-danger-ghost"
                  onClick={handleClearAll}
                  title="Очистить список"
                >
                  <Trash2 size={16} />
                  <span>Очистить</span>
                </button>
              </div>
            </div>

            {/* Document Items Table */}
            <OrderTable
              items={items}
              onUpdateNumber={handleUpdateNumber}
              onUpdateFio={handleUpdateFio}
              onSelectCandidate={handleSelectCandidate}
              onRemoveItem={handleRemoveItem}
              onPreviewText={(item) => setActivePreviewItem(item)}
              onDownloadItem={handleDownloadSingle}
            />
          </div>
        )}
      </main>

      {/* Minimal Swiss Workbench Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <span className="footer-copy">
            ПриказСорт — быстрый локальный инструмент для кадровиков и делопроизводителей.
          </span>
          <span className="footer-privacy">
            Обработка выполняется на клиенте через WebAssembly и JS. Никакие файлы и ФИО не покидают ваше устройство.
          </span>
        </div>
      </footer>

      {/* Extracted Text Preview Modal */}
      {activePreviewItem && (
        <TextPreviewModal
          item={activePreviewItem}
          onClose={() => setActivePreviewItem(null)}
        />
      )}
    </div>
  );
};

export default App;
