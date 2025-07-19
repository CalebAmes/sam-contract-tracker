import React, { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  MessageSquare,
  Brain,
  Search,
  Phone,
  Gavel,
  ArrowRight,
  Clock,
} from "lucide-react";
import { ContractNote, NoteType } from "../types";
import { API_CONFIG } from "../config/api";

interface ContractNotesProps {
  contractId: string;
  editable?: boolean;
}

const ContractNotes: React.FC<ContractNotesProps> = ({
  contractId,
  editable = true,
}) => {
  const [notes, setNotes] = useState<ContractNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [newNote, setNewNote] = useState({
    content: "",
    type: NoteType.GENERAL,
  });
  const [editContent, setEditContent] = useState("");

  const noteTypeConfig = {
    [NoteType.GENERAL]: {
      icon: MessageSquare,
      label: "General",
      color:
        "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700",
    },
    [NoteType.STRATEGY]: {
      icon: Brain,
      label: "Strategy",
      color:
        "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-300 dark:border-purple-700",
    },
    [NoteType.RESEARCH]: {
      icon: Search,
      label: "Research",
      color:
        "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-700",
    },
    [NoteType.CONTACT]: {
      icon: Phone,
      label: "Contact",
      color:
        "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-300 dark:border-orange-700",
    },
    [NoteType.DECISION]: {
      icon: Gavel,
      label: "Decision",
      color:
        "bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-300 dark:border-red-700",
    },
    [NoteType.FOLLOW_UP]: {
      icon: ArrowRight,
      label: "Follow Up",
      color:
        "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-300 dark:border-yellow-700",
    },
  };

  useEffect(() => {
    fetchNotes();
  }, [contractId]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${API_CONFIG.baseUrl}/api/contracts/${contractId}/notes`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch notes: ${response.status}`);
      }

      const data = await response.json();
      setNotes(data.notes || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch notes");
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newNote.content.trim()) {
      return;
    }

    try {
      const response = await fetch(
        `${API_CONFIG.baseUrl}/api/contracts/${contractId}/notes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: newNote.content.trim(),
            type: newNote.type,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to add note: ${response.status}`);
      }

      const data = await response.json();
      setNotes([data.note, ...notes]);
      setNewNote({ content: "", type: NoteType.GENERAL });
      setShowAddForm(false);
    } catch (err) {
      console.error("Error adding note:", err);
      setError("Failed to add note");
    }
  };

  const handleUpdateNote = async (noteId: string) => {
    if (!editContent.trim()) {
      return;
    }

    try {
      const response = await fetch(
        `${API_CONFIG.baseUrl}/api/contracts/notes/${noteId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: editContent.trim(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update note: ${response.status}`);
      }

      setNotes(
        notes.map((note) =>
          note.id === noteId
            ? {
                ...note,
                content: editContent.trim(),
                updatedAt: new Date().toISOString(),
              }
            : note
        )
      );
      setEditingNote(null);
      setEditContent("");
    } catch (err) {
      console.error("Error updating note:", err);
      setError("Failed to update note");
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm("Are you sure you want to delete this note?")) {
      return;
    }

    try {
      const response = await fetch(
        `${API_CONFIG.baseUrl}/api/contracts/notes/${noteId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete note: ${response.status}`);
      }

      setNotes(notes.filter((note) => note.id !== noteId));
    } catch (err) {
      console.error("Error deleting note:", err);
      setError("Failed to delete note");
    }
  };

  const startEditing = (note: ContractNote) => {
    setEditingNote(note.id);
    setEditContent(note.content);
  };

  const cancelEditing = () => {
    setEditingNote(null);
    setEditContent("");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h4 className="font-semibold flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Internal Notes
        </h4>
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="text-sm text-muted-foreground mt-2">Loading notes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Internal Notes
        </h4>
        {editable && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            <Plus className="w-4 h-4" />
            Add Note
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-100 border border-red-200 rounded-lg text-red-700 dark:bg-red-900 dark:border-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {showAddForm && (
        <form
          onSubmit={handleAddNote}
          className="p-4 border border-border rounded-lg bg-muted/50"
        >
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Note Type
              </label>
              <select
                value={newNote.type}
                onChange={(e) =>
                  setNewNote({ ...newNote, type: e.target.value as NoteType })
                }
                className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {Object.entries(noteTypeConfig).map(([type, config]) => (
                  <option key={type} value={type}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Content</label>
              <textarea
                value={newNote.content}
                onChange={(e) =>
                  setNewNote({ ...newNote, content: e.target.value })
                }
                placeholder="Enter your note..."
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                <Save className="w-4 h-4 inline mr-1" />
                Save Note
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {notes.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">
            No notes yet. Add your first note above.
          </p>
        ) : (
          notes.map((note) => {
            const config = noteTypeConfig[note.type];
            const Icon = config.icon;

            return (
              <div
                key={note.id}
                className="p-4 border border-border rounded-lg bg-card"
              >
                <div className="flex items-start justify-between mb-2">
                  <div
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${config.color}`}
                  >
                    <Icon className="w-3 h-3" />
                    {config.label}
                  </div>
                  {editable && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEditing(note)}
                        className="p-1 text-muted-foreground hover:text-blue-500"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="p-1 text-muted-foreground hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {editingNote === note.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-border rounded-lg bg-input text-foreground focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={cancelEditing}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
                      >
                        <X className="w-4 h-4 inline mr-1" />
                        Cancel
                      </button>
                      <button
                        onClick={() => handleUpdateNote(note.id)}
                        className="px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                      >
                        <Save className="w-4 h-4 inline mr-1" />
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-foreground whitespace-pre-wrap">
                      {note.content}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Created: {formatDate(note.createdAt)}
                      </div>
                      {note.updatedAt !== note.createdAt && (
                        <div className="flex items-center gap-1">
                          <Edit2 className="w-3 h-3" />
                          Updated: {formatDate(note.updatedAt)}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ContractNotes;
