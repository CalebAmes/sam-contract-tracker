import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Save, X, MessageSquare } from "lucide-react";
import { NoteType } from "../types";
import { API_CONFIG } from "../config/api";

interface AnalysisNote {
  id: string;
  contractId: string;
  analysisVersion: number;
  content: string;
  type: NoteType;
  createdAt: string;
  updatedAt: string;
}

interface AnalysisNotesProps {
  contractId: string;
  analysisVersion: number;
}

const AnalysisNotes: React.FC<AnalysisNotesProps> = ({
  contractId,
  analysisVersion,
}) => {
  const [notes, setNotes] = useState<AnalysisNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [newNoteType, setNewNoteType] = useState<NoteType>(NoteType.GENERAL);
  const [editContent, setEditContent] = useState("");
  const [deletingNote, setDeletingNote] = useState<string | null>(null);

  useEffect(() => {
    fetchNotes();
  }, [contractId, analysisVersion]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_CONFIG.baseUrl}/api/contracts/${contractId}/analysis/${analysisVersion}/notes`
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

  const addNote = async () => {
    if (!newNote.trim()) return;

    try {
      const response = await fetch(
        `${API_CONFIG.baseUrl}/api/contracts/${contractId}/analysis/${analysisVersion}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: newNote, type: newNoteType }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to add note: ${response.status}`);
      }

      const data = await response.json();
      setNotes((prev) => [data.note, ...prev]);
      setNewNote("");
      setNewNoteType(NoteType.GENERAL);
      setShowAddForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add note");
    }
  };

  const updateNote = async (noteId: string) => {
    if (!editContent.trim()) return;

    try {
      const response = await fetch(
        `${API_CONFIG.baseUrl}/api/analysis-notes/${noteId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: editContent }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to update note: ${response.status}`);
      }

      setNotes((prev) =>
        prev.map((note) =>
          note.id === noteId
            ? {
                ...note,
                content: editContent,
                updatedAt: new Date().toISOString(),
              }
            : note
        )
      );
      setEditingNote(null);
      setEditContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update note");
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      const response = await fetch(
        `${API_CONFIG.baseUrl}/api/analysis-notes/${noteId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to delete note: ${response.status}`);
      }

      setNotes((prev) => prev.filter((note) => note.id !== noteId));
      setDeletingNote(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete note");
    }
  };

  const startEdit = (note: AnalysisNote) => {
    setEditingNote(note.id);
    setEditContent(note.content);
  };

  const cancelEdit = () => {
    setEditingNote(null);
    setEditContent("");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getNoteTypeColor = (type: NoteType) => {
    switch (type) {
      case NoteType.STRATEGY:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case NoteType.RESEARCH:
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case NoteType.CONTACT:
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case NoteType.DECISION:
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case NoteType.FOLLOW_UP:
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getNoteTypeLabel = (type: NoteType) => {
    switch (type) {
      case NoteType.STRATEGY:
        return "Strategy";
      case NoteType.RESEARCH:
        return "Research";
      case NoteType.CONTACT:
        return "Contact";
      case NoteType.DECISION:
        return "Decision";
      case NoteType.FOLLOW_UP:
        return "Follow Up";
      default:
        return "General";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Analysis Notes
          <span className="text-sm font-normal text-muted-foreground">
            (Version {analysisVersion})
          </span>
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-2 px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
        >
          <Plus className="w-4 h-4" />
          Add Note
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {showAddForm && (
        <div className="p-4 border border-border rounded-lg bg-card">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Type:</label>
              <select
                value={newNoteType}
                onChange={(e) => setNewNoteType(e.target.value as NoteType)}
                className="text-sm border border-gray-300 rounded px-2 py-1 dark:border-gray-600 dark:bg-gray-800"
              >
                <option value={NoteType.GENERAL}>General</option>
                <option value={NoteType.STRATEGY}>Strategy</option>
                <option value={NoteType.RESEARCH}>Research</option>
                <option value={NoteType.CONTACT}>Contact</option>
                <option value={NoteType.DECISION}>Decision</option>
                <option value={NoteType.FOLLOW_UP}>Follow Up</option>
              </select>
            </div>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add your analysis note..."
              className="w-full p-3 border border-gray-300 rounded-lg resize-none dark:border-gray-600 dark:bg-gray-800"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewNote("");
                  setNewNoteType(NoteType.GENERAL);
                }}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={addNote}
                disabled={!newNote.trim()}
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                Add Note
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-sm text-muted-foreground mt-2">
              Loading notes...
            </p>
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No notes for this analysis version</p>
            <p className="text-sm">
              Add notes to track your thoughts and findings
            </p>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="p-4 border border-border rounded-lg bg-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${getNoteTypeColor(
                        note.type
                      )}`}
                    >
                      {getNoteTypeLabel(note.type)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(note.createdAt)}
                      {note.updatedAt !== note.createdAt && " (edited)"}
                    </span>
                  </div>
                  {editingNote === note.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded resize-none dark:border-gray-600 dark:bg-gray-800"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateNote(note.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                        >
                          <Save className="w-3 h-3" />
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="inline-flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          <X className="w-3 h-3" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">
                      {note.content}
                    </p>
                  )}
                </div>
                {editingNote !== note.id && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => startEdit(note)}
                      className="p-1 text-gray-400 hover:text-blue-500"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingNote(note.id)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Delete Note</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete this note? This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingNote(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteNote(deletingNote)}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisNotes;
