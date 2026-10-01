import { IconArrowRight, IconDisc, IconMusic, IconPiano, IconUsers, IconFolderPlus } from "@tabler/icons-react";
import { useMemo } from "react";
import { CoverArt } from "@/components/cover-art";
import { TrackList } from "@/components/track-list";
import { groupArtists, groupComposers } from "@/lib/catalog";
import { useLibrary } from "@/lib/library-provider";
import { useNav, type ViewName } from "@/lib/nav-provider";

const SECTIONS: {
  view: ViewName;
  label: string;
  icon: typeof IconDisc;
  color: string;
}[] = [
  {view: "albums", label: "专辑", icon: IconDisc, color: "text-violet-600 bg-violet-50"},
  {view: "artists", label: "艺术家", icon: IconUsers, color: "text-sky-600 bg-sky-50"},
  {view: "composers", label: "作曲家", icon: IconPiano, color: "text-amber-600 bg-amber-50"},
  {view: "songs", label: "歌曲", icon: IconMusic, color: "text-emerald-600 bg-emerald-50"},
];

export function DashboardView() {
  const {tracks, albums, importFolder, scanning} = useLibrary();
  const {setView, openAlbum} = useNav();
  const artistsCount = useMemo(() => groupArtists(tracks).length, [tracks]);
  const composersCount = useMemo(() => groupComposers(tracks).length, [tracks]);
  const recentTracks = useMemo(
    () => [...tracks].sort((a, b) => b.addedAt - a.addedAt).slice(0, 6),
    [tracks],
  );
  const recentAlbums = useMemo(
    () =>
      [...albums]
        .sort((a, b) => {
          const addedA = a.tracks.reduce((latest, track) => Math.max(latest, track.addedAt), 0);
          const addedB = b.tracks.reduce((latest, track) => Math.max(latest, track.addedAt), 0);
          return addedB - addedA;
        })
        .slice(0, 8),
    [albums],
  );
  const counts: Record<string, number> = {
    albums: albums.length,
    artists: artistsCount,
    composers: composersCount,
    songs: tracks.length,
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white px-6 py-5 shadow-sm shadow-zinc-900/[0.03]">
        <div>
          <p className="text-xs font-medium tracking-wide text-app-accent">KONZERT LIBRARY</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">Library</h1>
          <p className="mt-1 text-sm text-zinc-500">管理并浏览你的本地音乐收藏</p>
        </div>
        <button
          type="button"
          onClick={() => void importFolder()}
          disabled={scanning}
          className="flex items-center gap-2 rounded-xl bg-app-accent px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:brightness-90 disabled:opacity-50"
        >
          <IconFolderPlus className="h-4 w-4" />
          {scanning ? "正在导入…" : "导入音乐文件夹"}
        </button>
      </header>

      <section aria-label="曲库概览" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {SECTIONS.map(({view, label, icon: Icon, color}) => (
          <button
            key={view}
            type="button"
            onClick={() => setView(view)}
            className="group flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm shadow-zinc-900/[0.03] transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
          >
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${color}`}>
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-zinc-500">{label}</span>
              <span className="mt-1 block text-2xl font-semibold tabular-nums text-zinc-900">
                {counts[view].toLocaleString()}
              </span>
            </span>
            <IconArrowRight className="h-4 w-4 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-500" />
          </button>
        ))}
      </section>

      {tracks.length === 0 ? (
        <section className="flex flex-col items-center rounded-2xl border border-dashed border-zinc-300 bg-white/70 px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500">
            <IconMusic className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-base font-medium text-zinc-800">曲库还是空的</h2>
          <p className="mt-1 max-w-md text-sm text-zinc-500">
            导入本地音乐文件夹后，这里会显示最近添加的专辑和歌曲。
          </p>
        </section>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-900/[0.03]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900">最近添加的专辑</h2>
                <p className="mt-1 text-xs text-zinc-500">按曲目导入时间排序</p>
              </div>
              <button
                type="button"
                onClick={() => setView("albums")}
                className="text-xs font-medium text-zinc-500 transition hover:text-zinc-900"
              >
                查看全部
              </button>
            </div>
            {recentAlbums.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {recentAlbums.map((album) => (
                  <button
                    key={album.key}
                    type="button"
                    onClick={() => openAlbum(album.key)}
                    className="group min-w-0 text-left"
                  >
                    <CoverArt
                      coverId={album.coverId}
                      label={album.album}
                      className="aspect-square w-full rounded-xl transition group-hover:brightness-110"
                      labelClassName="text-xl"
                    />
                    <span className="mt-2 block truncate text-xs font-medium text-zinc-800" title={album.album}>
                      {album.album}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-zinc-500" title={album.albumArtist}>
                      {album.albumArtist}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-zinc-500">暂无专辑信息</p>
            )}
          </section>

          <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm shadow-zinc-900/[0.03]">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-zinc-900">最近添加的歌曲</h2>
              <p className="mt-1 text-xs text-zinc-500">最近入库的曲目</p>
            </div>
            <TrackList tracks={recentTracks} showIndex={false} showCoverArt />
          </section>
        </div>
      )}
    </div>
  );
}
