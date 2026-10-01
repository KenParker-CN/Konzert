import {IconArrowLeft} from "@tabler/icons-react";
import {AlbumGrid} from "@/components/album-grid";
import {useLibrary} from "@/lib/library-provider";
import {useNav} from "@/lib/nav-provider";
import {groupAlbums} from "@/lib/catalog";

export function RecordingDetail({recordingKey}: {recordingKey: string}) {
  const {tracks} = useLibrary();
  const {closeRecording, backLabel} = useNav();
  const isrc = recordingKey.startsWith("isrc:")
    ? recordingKey.slice("isrc:".length).trim().toLocaleLowerCase()
    : null;
  const recordingTracks = tracks.filter((track) =>
    isrc
      ? track.isrc?.trim().toLocaleLowerCase() === isrc
      : track.id === recordingKey.slice("track:".length),
  );
  const titleTrack = recordingTracks[0];
  const albums = groupAlbums(recordingTracks);

  return (
    <div className="flex flex-col gap-7">
      <button
        type="button"
        onClick={closeRecording}
        className="flex w-fit items-center gap-2 text-xs leading-4 text-zinc-500 transition hover:text-zinc-800"
      >
        <IconArrowLeft className="h-3.5 w-3.5" />
        {backLabel}
      </button>

      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold text-zinc-900">
          {titleTrack?.title ?? "录音不存在"}
        </h1>
        {titleTrack ? (
          <p className="text-sm text-zinc-500">{titleTrack.artist}</p>
        ) : null}
      </header>

      <section className="flex min-w-0 flex-col gap-3">
        <h2 className="text-base font-medium text-zinc-800">In albums</h2>
        <AlbumGrid albums={albums} emptyMessage="该录音尚未关联专辑" />
      </section>
    </div>
  );
}
