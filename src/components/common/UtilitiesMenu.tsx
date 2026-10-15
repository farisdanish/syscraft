import React from 'react';
import { 
  Dropdown, 
  DropdownTrigger, 
  DropdownContent, 
  DropdownItem, 
  DropdownItemIcon 
} from '@govtechmy/myds-react/dropdown';
import { Button } from '@govtechmy/myds-react/button';
import { MoreHorizontal, Download, Upload, Trash2 } from 'lucide-react';

export interface UtilitiesMenuProps {
  onExportBackup?: () => void;
  onImportBackup?: () => void;
  onOpenResetModal: () => void;
  clearTriggerBtnRef?: React.RefObject<HTMLButtonElement | null>;
  idPrefix?: string;
}

export const UtilitiesMenu: React.FC<UtilitiesMenuProps> = ({
  onExportBackup,
  onImportBackup,
  onOpenResetModal,
  clearTriggerBtnRef,
  idPrefix = 'studio',
}) => {
  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <Button
          id={`${idPrefix}-utilities-btn`}
          variant="default-outline"
          size="small"
          aria-label="Studio utilities and backup actions"
          style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          <MoreHorizontal size={13} />
          <span>Utilities</span>
        </Button>
      </DropdownTrigger>
      <DropdownContent 
        align="end" 
        side="bottom" 
        sideOffset={6} 
        className="studio-dropdown-content"
      >
        {onExportBackup && (
          <DropdownItem 
            id={`${idPrefix}-export-menu-item`}
            onClick={onExportBackup} 
            className="studio-dropdown-item"
          >
            <DropdownItemIcon>
              <Download size={14} />
            </DropdownItemIcon>
            <span>Export Backup JSON</span>
          </DropdownItem>
        )}
        {onImportBackup && (
          <DropdownItem 
            id={`${idPrefix}-import-menu-item`}
            onClick={onImportBackup} 
            className="studio-dropdown-item"
          >
            <DropdownItemIcon>
              <Upload size={14} />
            </DropdownItemIcon>
            <span>Import Backup JSON</span>
          </DropdownItem>
        )}
        <div className="studio-dropdown-separator" role="separator" />
        <DropdownItem 
          ref={clearTriggerBtnRef as unknown as React.Ref<HTMLDivElement>}
          id={`${idPrefix}-reset-menu-item`}
          variant="danger" 
          onClick={onOpenResetModal} 
          className="studio-dropdown-item danger"
        >
          <DropdownItemIcon>
            <Trash2 size={14} />
          </DropdownItemIcon>
          <span>Reset Learner Progress</span>
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
};
