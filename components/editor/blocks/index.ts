import { KanbanExtension } from "./kanban/kanban-extension";
import { WhiteboardExtension } from "./whiteboard/whiteboard-extension";
import { TodoExtension } from "./todo/todo-extension";
import { ImageExtension } from "./image/image-extension";

// Registre centralisé des extensions de blocs complexes
export const COMPLEX_BLOCK_EXTENSIONS = [
  KanbanExtension,
  WhiteboardExtension,
  TodoExtension,
  ImageExtension,
];

// Exports du bloc Kanban
export { KanbanExtension, DEFAULT_KANBAN_COLUMNS } from "./kanban/kanban-extension";
export * from "./kanban/kanban-types";
export * from "./kanban/kanban-colors";

// Exports du bloc Tableau blanc
export { WhiteboardExtension } from "./whiteboard/whiteboard-extension";
export * from "./whiteboard/whiteboard-types";

// Exports du bloc Liste de tâches
export { TodoExtension } from "./todo/todo-extension";
export * from "./todo/todo-types";

// Exports du bloc Image
export { ImageExtension } from "./image/image-extension";
export { ImagePageProvider } from "./image/image-page-context";
export * from "./image/image-types";

// Exports des composants et utilitaires communs
export { BlockWrapper } from "./common/block-wrapper";
export { useBlockFullscreen } from "./common/use-block-fullscreen";
export * from "./common/types";
