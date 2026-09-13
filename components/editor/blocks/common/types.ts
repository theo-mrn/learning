import type { ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export interface ComplexBlockMeta {
  type: string;
  title: string;
  icon?: ReactNode;
  description?: string;
}

export interface BlockWrapperProps {
  children: ReactNode;
  title?: string;
  onTitleChange?: (newTitle: string) => void;
  icon?: ReactNode;
  onDelete?: () => void;
  onDuplicate?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  headerActions?: ReactNode;
  className?: string;
  selected?: boolean;
}

export interface ComplexBlockNodeViewProps {
  editor: Editor;
  node: ProseMirrorNode;
  updateAttributes: (attrs: Record<string, unknown>) => void;
  deleteNode: () => void;
  selected: boolean;
}
