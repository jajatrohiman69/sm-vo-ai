"use client";

import { FormEvent, useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

type Project = {
  id: number;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  task_count?: number;
};

async function fetchProjects(): Promise<Project[]> {
  const response = await fetch(`${API_URL}/projects`);

  if (!response.ok) throw new Error("Gagal mengambil data project");

  return response.json();
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("Planning");
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadProjects() {
    try {
      setProjects(await fetchProjects());
      setError("");
    } catch {
      setError("Tidak dapat terhubung ke backend.");
    }
  }

  useEffect(() => {
    let active = true;

    fetchProjects()
      .then((data) => {
        if (active) {
          setProjects(data);
          setError("");
        }
      })
      .catch(() => {
        if (active) setError("Tidak dapat terhubung ke backend.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) return;

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const response = await fetch(
        editingProjectId
          ? `${API_URL}/projects/${editingProjectId}`
          : `${API_URL}/projects`,
        {
          method: editingProjectId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
            status,
          }),
        },
      );

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.detail || "Gagal menyimpan project.");
      }

      setName("");
      setDescription("");
      setStatus("Planning");
      setEditingProjectId(null);
      setMessage(
        editingProjectId
          ? "Project berhasil diperbarui."
          : "Project berhasil dibuat!",
      );

      await loadProjects();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Project gagal disimpan. Periksa koneksi backend.",
      );
    } finally {
      setSaving(false);
    }
  }

  function startEditing(project: Project) {
    setEditingProjectId(project.id);
    setName(project.name);
    setDescription(project.description || "");
    setStatus(project.status);
    setError("");
    setMessage("");
  }

  function cancelEditing() {
    setEditingProjectId(null);
    setName("");
    setDescription("");
    setStatus("Planning");
  }

  async function deleteProject(project: Project) {
    if (!window.confirm(`Hapus project "${project.name}"?`)) return;

    try {
      setError("");
      setMessage("");
      const response = await fetch(`${API_URL}/projects/${project.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.detail || "Project gagal dihapus.");
      }

      if (editingProjectId === project.id) cancelEditing();
      setMessage(data.message || "Project berhasil dihapus.");
      await loadProjects();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Project gagal dihapus.",
      );
    }
  }

  return (
    <section className="flex-1 min-w-0 p-6 md:p-10">
      <header className="mb-8">
        <p className="text-xs font-semibold tracking-widest text-blue-400">
          SOLUSI MACRO / PROJECTS
        </p>
        <h2 className="text-3xl font-bold mt-2">Project Management</h2>
        <p className="text-slate-400 mt-2 text-sm">
          Kelola dan pantau perkembangan proyek bisnis di Virtual HQ.
        </p>
      </header>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <form
            onSubmit={handleSubmit}
            className="bg-[#131316] border border-white/10 rounded-2xl p-6 h-fit"
          >
            <h3 className="font-semibold text-lg mb-6">
              {editingProjectId ? "Edit Project" : "＋ Create New Project"}
            </h3>

            <label className="text-sm text-slate-400">Project Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
              placeholder="Enter project name"
              className="w-full mt-2 mb-4 rounded-lg bg-[#09090b] border border-white/10 p-3 text-sm outline-none focus:border-blue-400"
            />

            <label className="text-sm text-slate-400">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your project..."
              rows={4}
              className="w-full mt-2 mb-4 rounded-lg bg-[#09090b] border border-white/10 p-3 text-sm outline-none focus:border-blue-400"
            />

            <label className="text-sm text-slate-400">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full mt-2 mb-6 rounded-lg bg-[#09090b] border border-white/10 p-3 text-sm"
            >
              <option>Planning</option>
              <option>In Progress</option>
              <option>Completed</option>
              <option>Cancelled</option>
            </select>

            {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
            {message && (
              <p className="text-sm text-green-400 mb-3">{message}</p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 p-3 font-medium text-sm"
            >
              {saving
                ? "Saving..."
                : editingProjectId
                  ? "Save Changes"
                  : "Create Project"}
            </button>
            {editingProjectId && (
              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                className="mt-2 w-full rounded-lg border border-white/10 p-3 text-sm text-slate-300 hover:bg-white/5"
              >
                Cancel Edit
              </button>
            )}
          </form>

          <div className="xl:col-span-2 bg-[#131316] border border-white/10 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold text-lg">Project Directory</h3>
              <span className="text-xs text-slate-400">
                {projects.length} Projects
              </span>
            </div>

            {loading ? (
              <p className="text-slate-400 text-sm">Loading projects...</p>
            ) : projects.length === 0 ? (
              <p className="text-slate-400 text-sm">No projects found.</p>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="border border-white/10 rounded-xl p-5"
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <h4 className="font-semibold">{project.name}</h4>
                        <p className="text-sm text-slate-400 mt-2">
                          {project.description || "No description"}
                        </p>
                        <p className="text-xs text-slate-500 mt-3">
                          Created:{" "}
                          {new Date(project.created_at).toLocaleDateString(
                            "id-ID",
                          )}
                        </p>
                      </div>
                      <span className="text-xs text-blue-300 bg-blue-500/10 rounded-lg px-3 py-1 h-fit">
                        {project.status}
                      </span>
                    </div>
                    <div className="mt-4 flex justify-end gap-2 border-t border-white/10 pt-4">
                      <button
                        onClick={() => startEditing(project)}
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:bg-white/5"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteProject(project)}
                        className="rounded-lg border border-red-400/20 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
  );
}
