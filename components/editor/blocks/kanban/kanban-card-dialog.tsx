"use client";

import { useState } from "react";
import {
  Calendar as CalendarIcon,
  Check,
  CheckSquare,
  ChevronsUpDown,
  Copy,
  Flag,
  Plus,
  Tag as TagIcon,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { fr } from "date-fns/locale";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  TAG_COLORS,
  getTagColorClass,
} from "./kanban-colors";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useKanbanMembers } from "./kanban-members-context";
import { assigneeInitials, assigneeLabel } from "./kanban-types";
import type {
  ChecklistItem,
  KanbanAssignee,
  KanbanCard,
  KanbanColumn,
  KanbanPriority,
  KanbanTag,
} from "./kanban-types";

function createChecklistId(): string {
  return `chk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function createTagId(): string {
  return `tag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export interface KanbanCardDialogProps {
  card: KanbanCard | null;
  columns: KanbanColumn[];
  currentColumnId: string;
  isOpen: boolean;
  isNew?: boolean;
  onClose: () => void;
  onSave: (updated: KanbanCard, targetColumnId: string) => void;
  onDuplicateCard?: (cardId: string) => void;
  onDeleteCard?: (cardId: string) => void;
  /** `false` pour un membre en lecture seule : la carte s'ouvre pour être
   * lue, tous ses champs sont inertes et le pied de page n'offre que
   * « Fermer ». */
  canEdit?: boolean;
}

function KanbanCardDialogContent({
  card,
  columns,
  currentColumnId,
  isNew = false,
  onClose,
  onSave,
  onDuplicateCard,
  onDeleteCard,
  canEdit = true,
}: Omit<KanbanCardDialogProps, "isOpen"> & { card: KanbanCard }) {
  const [title, setTitle] = useState(card.title || "");
  const [description, setDescription] = useState(card.description || "");
  const [priority, setPriority] = useState<KanbanPriority>(card.priority || "none");
  const [dueDate, setDueDate] = useState<string | null>(card.dueDate || null);
  const [tags, setTags] = useState<KanbanTag[]>(card.tags || []);
  const [checklists, setChecklists] = useState<ChecklistItem[]>(card.checklists || []);
  const [assignees, setAssignees] = useState<KanbanAssignee[]>(
    card.assignees ?? []
  );
  const { members } = useKanbanMembers();
  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
  const [targetColumnId, setTargetColumnId] = useState(currentColumnId);

  function toggleAssignee(member: KanbanAssignee) {
    setAssignees((current) =>
      current.some((a) => a.userId === member.userId)
        ? current.filter((a) => a.userId !== member.userId)
        : [...current, member]
    );
  }
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const [newChecklistText, setNewChecklistText] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("amber");

  // Checklist management
  const handleAddChecklist = () => {
    if (!newChecklistText.trim()) return;
    const newItem: ChecklistItem = {
      id: createChecklistId(),
      text: newChecklistText.trim(),
      completed: false,
    };
    setChecklists([...checklists, newItem]);
    setNewChecklistText("");
  };

  const handleToggleChecklist = (id: string) => {
    setChecklists((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const handleDeleteChecklist = (id: string) => {
    setChecklists((prev) => prev.filter((item) => item.id !== id));
  };

  // Tags management
  const handleAddTag = () => {
    if (!newTagName.trim()) return;
    const newTag: KanbanTag = {
      id: createTagId(),
      name: newTagName.trim(),
      color: newTagColor,
    };
    setTags([...tags, newTag]);
    setNewTagName("");
    setIsAddingTag(false);
  };

  const handleRemoveTag = (tagId: string) => {
    setTags(tags.filter((t) => t.id !== tagId));
  };

  const handleSave = () => {
    const finalChecklists = [...checklists];
    if (newChecklistText.trim()) {
      finalChecklists.push({
        id: createChecklistId(),
        text: newChecklistText.trim(),
        completed: false,
      });
    }

    const finalCard: KanbanCard = {
      ...card,
      title: title.trim() || "Sans titre",
      description: description.trim() || undefined,
      priority,
      dueDate,
      tags,
      checklists: finalChecklists,
      // `undefined` plutôt qu'un tableau vide : une carte sans assigné ne
      // porte pas le champ, ce qui garde le document léger.
      assignees: assignees.length > 0 ? assignees : undefined,
    };
    onSave(finalCard, targetColumnId);
  };

  const completedCount = checklists.filter((c) => c.completed).length;

  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="gap-1 pb-1">
          <DialogTitle>
            {isNew ? "Nouvelle tâche" : "Modifier la tâche"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isNew
              ? "Créez une tâche pour votre tableau Kanban."
              : "Modifiez les informations et le statut de cette tâche."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Titre de la tâche */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.75rem] font-medium text-muted-foreground">
              Titre de la tâche
            </label>
            <Input
              type="text"
              readOnly={!canEdit}
              // Pas de `autoFocus` en lecture seule : focaliser un champ
              // inerte à l'ouverture suggère qu'on peut y écrire.
              autoFocus={canEdit}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex : Concevoir la maquette..."
              className="h-9 text-sm font-medium"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
          </div>

          {/* Métadonnées : Colonne, Priorité & Échéance */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Statut / Colonne */}
            <div className="flex flex-col gap-1">
              <label className="text-[0.7rem] font-medium text-muted-foreground">
                Colonne
              </label>
              <select
                value={targetColumnId}
                disabled={!canEdit}
                onChange={(e) => setTargetColumnId(e.target.value)}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs font-medium text-foreground outline-none focus-visible:border-ring"
              >
                {columns.map((col) => (
                  <option
                    key={col.id}
                    value={col.id}
                    className="bg-popover text-popover-foreground"
                  >
                    {col.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Assignés : uniquement des membres de l'espace. */}
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-1.5 text-[0.7rem] font-medium text-muted-foreground">
                <Users className="size-3" />
                Assigné{assignees.length > 1 ? "s" : ""}
                {assignees.length > 0 && ` (${assignees.length})`}
              </label>

              {members.length === 0 ? (
                <p className="text-[0.7rem] text-muted-foreground/70">
                  Aucun membre dans cet espace.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {/* Les assignés retenus, toujours visibles : dans un
                      combobox seul, il faudrait ouvrir le menu pour savoir
                      qui est sur la carte. */}
                  {assignees.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {assignees.map((assignee) => (
                        <span
                          key={assignee.userId}
                          className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[0.7rem]"
                        >
                          <span
                            aria-hidden
                            className="flex size-5 items-center justify-center rounded-full bg-primary text-[0.6rem] font-medium text-primary-foreground"
                          >
                            {assigneeInitials(assignee)}
                          </span>
                          <span className="max-w-28 truncate">
                            {assigneeLabel(assignee)}
                          </span>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => toggleAssignee(assignee)}
                              aria-label={`Retirer ${assigneeLabel(assignee)}`}
                              className="rounded hover:opacity-70"
                            >
                              <X className="size-2.5" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Le combobox n'existe qu'en écriture : en lecture seule,
                      les pastilles ci-dessus suffisent. */}
                  {canEdit && (
                    <Popover
                      open={isAssigneeOpen}
                      onOpenChange={setIsAssigneeOpen}
                    >
                      <PopoverTrigger
                        render={
                          <button
                            type="button"
                            // Pas de `role="combobox"` posé à la main : il
                            // exigerait `aria-controls`, dont l'id est généré
                            // par le popover et hors de notre portée. Base UI
                            // ajoute déjà les attributs d'état au
                            // déclencheur ; `aria-haspopup` décrit ce qui
                            // s'ouvre, et c'est exact.
                            aria-haspopup="listbox"
                            aria-label="Assigner des membres"
                            className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-2 text-xs text-muted-foreground outline-none hover:border-foreground/40 focus-visible:border-ring"
                          />
                        }
                      >
                        <span>
                          {assignees.length === 0
                            ? "Assigner à…"
                            : `${assignees.length} personne${assignees.length > 1 ? "s" : ""} assignée${assignees.length > 1 ? "s" : ""}`}
                        </span>
                        <ChevronsUpDown className="size-3 shrink-0 opacity-50" />
                      </PopoverTrigger>

                      <PopoverContent
                        align="start"
                        className="w-(--anchor-width) min-w-56 p-0"
                      >
                        {/* `shouldFilter` reste au défaut : ici la recherche
                            est locale, contrairement à la palette Cmd+K du
                            projet qui filtre côté serveur. */}
                        <Command>
                          <CommandInput
                            placeholder="Chercher un membre…"
                            className="h-8 text-xs"
                          />
                          <CommandList className="max-h-52">
                            <CommandEmpty className="py-3 text-xs">
                              Aucun membre trouvé.
                            </CommandEmpty>
                            <CommandGroup>
                              {members.map((member) => {
                                const isAssigned = assignees.some(
                                  (a) => a.userId === member.userId
                                );
                                return (
                                  <CommandItem
                                    key={member.userId}
                                    // La valeur alimente la recherche : nom
                                    // ET email, pour retrouver quelqu'un par
                                    // l'un ou l'autre.
                                    value={`${assigneeLabel(member)} ${member.email}`}
                                    onSelect={() => toggleAssignee(member)}
                                    className="gap-2 text-xs"
                                  >
                                    <span
                                      aria-hidden
                                      className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-medium ${
                                        isAssigned
                                          ? "bg-primary text-primary-foreground"
                                          : "bg-muted text-muted-foreground"
                                      }`}
                                    >
                                      {assigneeInitials(member)}
                                    </span>
                                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                                      <span className="truncate">
                                        {assigneeLabel(member)}
                                      </span>
                                      {member.name && (
                                        <span className="truncate text-[0.65rem] text-muted-foreground">
                                          {member.email}
                                        </span>
                                      )}
                                    </span>
                                    {isAssigned && (
                                      <Check className="size-3.5 shrink-0 text-primary" />
                                    )}
                                  </CommandItem>
                                );
                              })}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              )}
            </div>

            {/* Priorité */}
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-1.5 text-[0.7rem] font-medium text-muted-foreground">
                <Flag className="size-3" />
                Priorité
              </label>
              <select
                value={priority}
                disabled={!canEdit}
                onChange={(e) => setPriority(e.target.value as KanbanPriority)}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs text-foreground outline-none focus-visible:border-ring"
              >
                <option value="none" className="bg-popover text-popover-foreground">
                  Sans priorité
                </option>
                <option value="low" className="bg-popover text-popover-foreground">
                  Basse
                </option>
                <option value="medium" className="bg-popover text-popover-foreground">
                  Moyenne
                </option>
                <option value="high" className="bg-popover text-popover-foreground">
                  Haute
                </option>
                <option value="urgent" className="bg-popover text-popover-foreground">
                  Urgente
                </option>
              </select>
            </div>

            {/* Échéance avec shadcn Calendar */}
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-1.5 text-[0.7rem] font-medium text-muted-foreground">
                <CalendarIcon className="size-3" />
                Échéance
              </label>
              <div className="flex items-center gap-1">
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger
                    render={
                      <button
                        type="button"
                        className="flex h-8 flex-1 items-center justify-start gap-1.5 rounded-lg border border-input bg-transparent px-2 text-xs text-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:border-ring"
                      />
                    }
                  >
                    <CalendarIcon className="size-3 text-muted-foreground shrink-0" />
                    <span className={dueDate ? "text-foreground font-medium truncate" : "text-muted-foreground truncate"}>
                      {dueDate
                        ? new Intl.DateTimeFormat("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }).format(new Date(dueDate + "T12:00:00"))
                        : "Choisir..."}
                    </span>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-0 shadow-lifted z-[60]">
                    <Calendar
                      mode="single"
                      selected={dueDate ? new Date(dueDate + "T12:00:00") : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, "0");
                          const day = String(date.getDate()).padStart(2, "0");
                          setDueDate(`${year}-${month}-${day}`);
                        } else {
                          setDueDate(null);
                        }
                        setIsCalendarOpen(false);
                      }}
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>

                {dueDate && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    hidden={!canEdit}
                    onClick={() => setDueDate(null)}
                    title="Effacer l'échéance"
                  >
                    <X className="size-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Étiquettes */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-[0.7rem] font-medium text-muted-foreground">
              <TagIcon className="size-3" />
              Étiquettes
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${getTagColorClass(
                    tag.color
                  )}`}
                >
                  {tag.name}
                  <button
                    type="button"
                    hidden={!canEdit}
                    onClick={() => handleRemoveTag(tag.id)}
                    className="ml-0.5 rounded hover:opacity-75"
                  >
                    <X className="size-2.5" />
                  </button>
                </span>
              ))}

              {/* Créer ou retirer une étiquette est une écriture : en lecture
                  seule, seules les étiquettes existantes restent visibles. */}
              {!canEdit ? null : isAddingTag ? (
                <div className="flex items-center gap-1 rounded-lg border border-input p-1">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Nom..."
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddTag();
                      if (e.key === "Escape") setIsAddingTag(false);
                    }}
                    className="h-6 w-20 bg-transparent px-1 text-xs outline-none"
                  />
                  <select
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    className="h-6 rounded border border-input bg-transparent px-1 text-[0.65rem] outline-none"
                  >
                    {TAG_COLORS.map((c) => (
                      <option
                        key={c.id}
                        value={c.id}
                        className="bg-popover text-popover-foreground"
                      >
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="xs"
                    onClick={handleAddTag}
                    className="h-6 px-1.5 text-[0.65rem]"
                  >
                    OK
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setIsAddingTag(false)}
                    className="size-6"
                  >
                    <X className="size-3" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingTag(true)}
                  className="inline-flex h-6 items-center gap-1 rounded-md border border-dashed border-input px-2 text-[0.7rem] text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                >
                  <Plus className="size-2.5" />
                  <span>Ajouter</span>
                </button>
              )}
            </div>
          </div>

          {/* Description & Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.7rem] font-medium text-muted-foreground">
              Description & Notes
            </label>
            <Textarea
              readOnly={!canEdit}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ajouter des notes ou détails sur cette tâche..."
              className="min-h-[70px] text-xs"
            />
          </div>

          {/* Sous-tâches */}
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-[0.7rem] font-medium text-muted-foreground">
              <CheckSquare className="size-3" />
              Sous-tâches{" "}
              {checklists.length > 0 && `(${completedCount}/${checklists.length})`}
            </label>

            {checklists.length > 0 && (
              <div className="flex flex-col gap-1">
                {checklists.map((item) => (
                  <div
                    key={item.id}
                    className="group flex items-center justify-between gap-2 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted/40"
                  >
                    <label className="flex flex-1 cursor-pointer items-center gap-2 text-xs">
                      <Checkbox
                        checked={item.completed}
                        onCheckedChange={() => handleToggleChecklist(item.id)}
                        className="size-3.5 [&>span>svg]:size-2.5"
                      />
                      <span
                        className={
                          item.completed
                            ? "text-muted-foreground line-through"
                            : "text-foreground"
                        }
                      >
                        {item.text}
                      </span>
                    </label>
                    <button
                      type="button"
                      hidden={!canEdit}
                      onClick={() => handleDeleteChecklist(item.id)}
                      className="text-muted-foreground/60 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Ajout de sous-tâche : écriture, donc absent en lecture seule. */}
            {canEdit && (
            <div className="flex items-center gap-1.5 pt-0.5">
              <Input
                type="text"
                placeholder="Nouvelle sous-tâche..."
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddChecklist();
                  }
                }}
                className="h-7 text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddChecklist}
                className="h-7 px-2.5 text-xs"
              >
                Ajouter
              </Button>
            </div>
            )}
          </div>
        </div>

        {/* Pied de page shadcn DialogFooter */}
        <DialogFooter className="mt-2 flex flex-row items-center justify-between gap-2 border-t pt-3">
          <div className="flex items-center gap-1">
            {canEdit && !isNew && onDeleteCard && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onDeleteCard(card.id);
                  onClose();
                }}
                className="h-8 gap-1 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
                <span>Supprimer</span>
              </Button>
            )}

            {canEdit && !isNew && onDuplicateCard && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onDuplicateCard(card.id);
                  onClose();
                }}
                className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Copy className="size-3.5" />
                <span>Dupliquer</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="h-8 px-3 text-xs"
            >
              {/* Sans enregistrement possible, « Annuler » n'a plus de sens :
                  il ne reste qu'à refermer la carte. */}
              {canEdit ? "Annuler" : "Fermer"}
            </Button>
            {canEdit && (
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              className="h-8 px-4 text-xs font-medium"
            >
              {isNew ? "Créer la tâche" : "Enregistrer"}
            </Button>
            )}
          </div>
        </DialogFooter>
    </DialogContent>
  );
}

/**
 * Le `Dialog` Base UI reste monté en permanence : c'est lui (pas ce
 * composant) qui décide quand rendre son portail selon `open`. Le démonter
 * ici quand `isOpen` passe à `false` empêchait Base UI de gérer proprement
 * son propre cycle d'ouverture/fermeture (animations de sortie, restitution
 * du focus au déclencheur) et pouvait laisser la modale ne jamais apparaître
 * si `card` redevenait `null` avant que Base UI n'ait eu la main.
 *
 * Le contenu (qui a besoin d'une carte pour initialiser son state) n'est
 * rendu que lorsque `card` existe ; `key={card.id}` réinitialise le
 * formulaire à chaque nouvelle carte ouverte, comme avant.
 */
export function KanbanCardDialog({ card, isOpen, onClose, ...rest }: KanbanCardDialogProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      {card && (
        <KanbanCardDialogContent
          key={card.id}
          card={card}
          onClose={onClose}
          {...rest}
        />
      )}
    </Dialog>
  );
}
