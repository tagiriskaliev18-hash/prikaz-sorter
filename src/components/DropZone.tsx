import React, { useRef, useState, useCallback } from 'react';
import { UploadCloud, FolderOpen, Sparkles, FileText, CheckCircle2 } from 'lucide-react';

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  onLoadDemo: () => void;
  isLoadingDemo?: boolean;
  disabled?: boolean;
}

const SUPPORTED_BADGES = [
  { label: '.DOCX', note: 'Word' },
  { label: '.PDF', note: 'Текст и сканы' },
  { label: '.RTF', note: 'Rich Text' },
  { label: '.ODT', note: 'OpenOffice' },
  { label: '.TXT', note: 'Текст' },
  { label: 'PNG / JPG', note: 'OCR' },
];

export const DropZone: React.FC<DropZoneProps> = ({
  onFilesSelected,
  onLoadDemo,
  isLoadingDemo = false,
  disabled = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      dragCounter.current = 0;

      if (disabled) return;

      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) {
        onFilesSelected(droppedFiles);
      }
    },
    [disabled, onFilesSelected]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onFilesSelected(files);
      e.target.value = '';
    }
  };

  const handleFolderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onFilesSelected(files);
      e.target.value = '';
    }
  };

  return (
    <div
      className={`dropzone-container ${isDragOver ? 'dropzone-active' : ''} ${disabled ? 'dropzone-disabled' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".docx,.pdf,.rtf,.txt,.odt,.doc,.png,.jpg,.jpeg,.webp"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        // @ts-expect-error webkitdirectory attribute is standard for directory upload
        webkitdirectory=""
        style={{ display: 'none' }}
        onChange={handleFolderInputChange}
      />

      <div className="dropzone-inner">
        <div className="dropzone-icon-wrapper">
          <UploadCloud className="dropzone-icon" />
        </div>

        <div className="dropzone-text-group">
          <h3 className="dropzone-title">
            Перетащите файлы приказов сюда или выберите на диске
          </h3>
          <p className="dropzone-subtitle">
            Автоматическое распознавание номера приказа, даты и ФИО сотрудника
          </p>
        </div>

        <div className="dropzone-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            <FileText size={16} />
            <span>Выбрать файлы</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => folderInputRef.current?.click()}
            disabled={disabled}
            title="Загрузить сразу все файлы из папки"
          >
            <FolderOpen size={16} />
            <span>Выбрать папку</span>
          </button>

          <span className="dropzone-divider">или</span>

          <button
            type="button"
            className="btn btn-demo"
            onClick={onLoadDemo}
            disabled={disabled || isLoadingDemo}
            title="Загрузить 3 синтетических приказа (DOCX и RTF) для проверки работы"
          >
            <Sparkles size={16} className={isLoadingDemo ? 'spin' : ''} />
            <span>{isLoadingDemo ? 'Создание демо...' : 'Загрузить 3 демо-приказа'}</span>
          </button>
        </div>

        <div className="dropzone-formats">
          <span className="dropzone-formats-label">Поддерживаемые форматы:</span>
          <div className="format-badges">
            {SUPPORTED_BADGES.map((b) => (
              <span key={b.label} className="format-badge" title={b.note}>
                <span className="badge-name">{b.label}</span>
                <span className="badge-note">{b.note}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="dropzone-privacy-note">
          <CheckCircle2 size={14} className="privacy-icon" />
          <span>100% конфиденциально: файлы не загружаются на сервер, парсинг происходит в вашем браузере</span>
        </div>
      </div>
    </div>
  );
};
