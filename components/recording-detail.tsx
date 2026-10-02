import {IconArrowLeft} from "@tabler/icons-react";
import {AlbumGrid} from "@/components/album-grid";
import {CatalogTitle} from "@/components/catalog-title";
import {formatDuration, formatFileSize, formatReleaseDate, formatSampleRate} from "@/lib/format";
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
  const metadata: { label: string; value: string }[] = titleTrack
    ? [
      {label: "作曲家", value: titleTrack.composer},
      {label: "专辑", value: titleTrack.album},
      {label: "发行日期", value: formatReleaseDate(titleTrack.releaseDate)},
      {label: "ISRC", value: titleTrack.isrc?.trim() ?? ""},
      {
        label: "碟号 / 音轨",
        value:
          titleTrack.discNo == null && titleTrack.trackNo == null
            ? ""
            : `${titleTrack.discNo ?? ""}${titleTrack.trackNo == null ? "" : ` / ${titleTrack.trackNo}`}`,
        },
        {label: "时长", value: titleTrack.duration > 0 ? formatDuration(titleTrack.duration) : ""},
        {
          label: "音频规格",
          value: [
            titleTrack.lossless ? "无损" : "",
            titleTrack.sampleRate
              ? formatSampleRate(titleTrack.sampleRate)
              : "",
            titleTrack.bitDepth ? `${titleTrack.bitDepth} bit` : "",
            titleTrack.bitrate
              ? `${Math.round(titleTrack.bitrate / 1000)} kbps`
              : "",
          ]
            .filter(Boolean)
            .join(" · "),
        },
        {label: "文件大小", value: titleTrack.fileSize > 0 ? formatFileSize(titleTrack.fileSize) : ""},
      ].filter(({value}) => value)
    : [];

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
          {titleTrack ? (
            <CatalogTitle
              title={titleTrack.title}
              composer={titleTrack.composer}
            />
          ) : "录音不存在"}
        </h1>
        {titleTrack ? (
          <p className="text-sm text-zinc-500">{titleTrack.artist}</p>
        ) : null}
      </header>

      {titleTrack ? (
        <section className="flex min-w-0 flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-800">Metadata</h2>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <dl className="grid grid-cols-[minmax(6rem,0.35fr)_minmax(0,1fr)] gap-x-4 text-sm">
              {metadata.map(({label, value}) => (
                <div key={label} className="contents">
                  <dt className="border-t border-zinc-100 py-2 font-medium text-zinc-500">
                    {label}
                  </dt>
                  <dd className="min-w-0 border-t border-zinc-100 py-2 whitespace-pre-wrap break-words text-zinc-800">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      ) : null}

      <section className="flex min-w-0 flex-col gap-3">
        <h2 className="text-base font-medium text-zinc-800">In albums</h2>
        <AlbumGrid albums={albums} emptyMessage="该录音尚未关联专辑" />
      </section>
    </div>
  );
}
