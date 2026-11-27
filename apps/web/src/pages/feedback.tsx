// Masukan peserta uji coba (langkah 5.1): tersimpan di HP, terkirim saat ada sinyal.
import { FEEDBACK_RATINGS, FEEDBACK_TOPICS, type FeedbackTopic } from '@ib/shared';
import { Link } from '@tanstack/react-router';
import { CircleCheck, Frown, Meh, Smile, type LucideIcon } from 'lucide-react';
import { useId, useState } from 'react';

import { ErrorMessage } from '@/components/error-message';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Panel } from '@/components/ui/panel';
import { NativeSelect } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useFeedback, useRepo, useSession } from '@/data';
import { errorIdOf, fieldA11y } from '@/lib/a11y';
import { RATING_TEXT, TOPIC_TEXT } from '@/lib/feedback-text';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const FACE: Record<number, LucideIcon> = { 1: Frown, 2: Meh, 3: Smile };

export function FeedbackPage() {
  const repo = useRepo();
  const session = useSession();
  const all = useFeedback();
  const mine = session ? all?.filter((f) => f.userId === session.user.id) : undefined;
  const id = useId();
  const [rating, setRating] = useState<number | null>(null);
  const [topic, setTopic] = useState<FeedbackTopic>('general');
  const [text, setText] = useState('');
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [sent, setSent] = useState(false);

  async function submit() {
    if (rating === null) {
      setMissing(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await repo.sendFeedback({ topic, rating, text });
      setSent(true);
      setRating(null);
      setText('');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {sent ? (
        <Panel title="Terima kasih">
          <p role="status" className="flex items-start gap-2 font-semibold text-primary">
            <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            Masukan tersimpan. Terkirim ke admin saat ada sinyal.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSent(false);
              }}
            >
              Tulis masukan lain
            </Button>
            <Button asChild variant="ghost">
              <Link to="/lainnya">Kembali</Link>
            </Button>
          </div>
        </Panel>
      ) : (
        <form
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <fieldset aria-describedby={missing ? errorIdOf(`${id}-rating`) : undefined}>
            <legend className="mb-2 font-semibold">Bagaimana rasanya memakai aplikasi ini?</legend>
            <div className="grid grid-cols-3 gap-2">
              {FEEDBACK_RATINGS.map((value) => {
                const Face = FACE[value] ?? Meh;
                return (
                  <label
                    key={value}
                    className={cn(
                      'flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-(length:--bw) text-center has-focus-visible:outline-3 has-focus-visible:outline-ring',
                      rating === value
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input bg-card',
                    )}
                  >
                    <input
                      type="radio"
                      name={`${id}-rating`}
                      checked={rating === value}
                      onChange={() => {
                        setRating(value);
                        setMissing(false);
                      }}
                      className="sr-only"
                    />
                    <Face aria-hidden="true" className="size-8" />
                    <span className="font-bold">{RATING_TEXT[value]}</span>
                  </label>
                );
              })}
            </div>
            {missing && (
              <p
                id={errorIdOf(`${id}-rating`)}
                role="alert"
                className="mt-1 font-semibold text-alarm"
              >
                Pilih salah satu wajah dulu.
              </p>
            )}
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-topic`}>Tentang bagian</Label>
            <NativeSelect
              id={`${id}-topic`}
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value as FeedbackTopic);
              }}
            >
              {FEEDBACK_TOPICS.map((t) => (
                <option key={t} value={t}>
                  {TOPIC_TEXT[t]}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-text`}>Ceritakan (boleh kosong)</Label>
            <Textarea
              id={`${id}-text`}
              maxLength={1000}
              placeholder="Contoh: tombol simpan susah dicari, tulisan kurang besar"
              value={text}
              {...fieldA11y(`${id}-text`, null)}
              onChange={(e) => {
                setText(e.target.value);
              }}
            />
          </div>

          {error !== null && <ErrorMessage error={error} />}
          <Button type="submit" size="lg" disabled={busy}>
            {busy ? 'Menyimpan…' : 'Kirim masukan'}
          </Button>
          <p className="text-sm text-muted-foreground">
            Masukan tersimpan di HP dan terkirim ke admin saat ada sinyal.
          </p>
        </form>
      )}

      {mine && mine.length > 0 && (
        <Panel title="Masukan Anda">
          <ul className="flex flex-col">
            {mine.map((f) => (
              <li key={f.id} className="border-t-(length:--bw) py-2 first:border-t-0">
                <span className="block font-semibold">
                  {RATING_TEXT[f.rating]} · {TOPIC_TEXT[f.topic]}
                </span>
                {f.text && <span className="block">{f.text}</span>}
                <span className="block text-sm text-muted-foreground">
                  {formatDateTime(f.createdAt)}
                  {f.pending ? ' · menunggu dikirim' : ' · terkirim'}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
