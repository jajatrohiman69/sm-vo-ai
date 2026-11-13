"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  API_URL,
  DEFAULT_WORKSPACE_SETTINGS,
  resolveLogoUrl,
  type WorkspaceSettings,
} from "@/lib/api";

const BRAND_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const BRAND_PALETTES = ["indigo", "blue"];
const WorkspaceBrandingContext = createContext<WorkspaceSettings>(
  DEFAULT_WORKSPACE_SETTINGS,
);

function applyBrandColor(color: string) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return;
  const channels = color.match(/[0-9a-f]{2}/gi)?.map((channel) =>
    Number.parseInt(channel, 16),
  );
  if (!channels || channels.length !== 3) return;

  const root = document.documentElement;
  root.style.setProperty("--brand-color", color);
  for (const palette of BRAND_PALETTES) {
    for (const shade of BRAND_SHADES) {
      const mix = shade < 500
        ? 0.85 * ((500 - shade) / 500)
        : 0.5 * ((shade - 500) / 500);
      const target = shade < 500 ? 255 : 0;
      const value = channels
        .map((channel) => Math.round(channel + (target - channel) * mix))
        .join(" ");
      root.style.setProperty(`--color-${palette}-${shade}`, `rgb(${value})`);
    }
  }
}

function applyBranding(settings: WorkspaceSettings) {
  const officeName = settings.office_name || DEFAULT_WORKSPACE_SETTINGS.office_name;
  const badge = settings.office_badge || DEFAULT_WORKSPACE_SETTINGS.office_badge;
  document.title = `${officeName} · ${badge}`;

  const description = document.querySelector<HTMLMetaElement>(
    'meta[name="description"]',
  );
  if (description) {
    description.content =
      settings.office_subtitle || DEFAULT_WORKSPACE_SETTINGS.office_subtitle;
  }

  let icon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (!icon) {
    icon = document.createElement("link");
    icon.rel = "icon";
    document.head.appendChild(icon);
  }
  icon.href = resolveLogoUrl(settings.logo_url);
  applyBrandColor(settings.brand_color || DEFAULT_WORKSPACE_SETTINGS.brand_color);
}

export function useWorkspaceBranding() {
  return useContext(WorkspaceBrandingContext);
}

export default function BrandingRuntime({
  children,
}: {
  children: ReactNode;
}) {
  const [branding, setBranding] = useState(DEFAULT_WORKSPACE_SETTINGS);

  useEffect(() => {
    let active = true;

    async function loadBranding() {
      try {
        const response = await fetch(`${API_URL}/workspace/settings`);
        if (!response.ok) {
          throw new Error(`Gagal memuat branding (${response.status}).`);
        }
        const settings = (await response.json()) as WorkspaceSettings;
        if (active) {
          setBranding(settings);
          applyBranding(settings);
        }
      } catch (error) {
        console.error("Gagal menerapkan branding workspace.", error);
      }
    }

    const onBrandingUpdated = () => void loadBranding();
    void loadBranding();
    window.addEventListener("vhq-branding-updated", onBrandingUpdated);
    return () => {
      active = false;
      window.removeEventListener("vhq-branding-updated", onBrandingUpdated);
    };
  }, []);

  return (
    <WorkspaceBrandingContext.Provider value={branding}>
      {children}
    </WorkspaceBrandingContext.Provider>
  );
}
