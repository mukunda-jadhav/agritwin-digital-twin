import { useTranslation } from 'react-i18next';
import { Languages, Volume2, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from './ui/button';
export function LanguageSelect() {
  const { t, i18n } = useTranslation();
  return (
    <label className="language-select">
      <Languages size={17} aria-hidden="true" />
      <select
        aria-label={t('Language')}
        value={i18n.language}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
      >
        <option value="en">English</option>
        <option value="hi">हिन्दी</option>
        <option value="mr">मराठी</option>
      </select>
    </label>
  );
}
export function Speak({ text }: { text: string }) {
  const { t, i18n } = useTranslation(),
    [speaking, setSpeaking] = useState(false),
    [message, setMessage] = useState('');
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          if (speaking) {
            speechSynthesis.cancel();
            setSpeaking(false);
            return;
          }
          const synth = window.speechSynthesis,
            voice = synth?.getVoices().find((v) => v.lang.toLowerCase().startsWith(i18n.language));
          if (!voice) {
            setMessage(t('No voice is available for this language. Please read the summary.'));
            return;
          }
          setMessage('');
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.voice = voice;
          utterance.lang = voice.lang;
          utterance.rate = 0.9;
          utterance.onend = () => setSpeaking(false);
          utterance.onerror = () => setSpeaking(false);
          setSpeaking(true);
          synth.speak(utterance);
        }}
      >
        {speaking ? <Square size={15} /> : <Volume2 size={15} />}{' '}
        {t(speaking ? 'Stop speaking' : 'Listen to summary')}
      </Button>
      {message && (
        <p role="status" className="muted">
          {message}
        </p>
      )}
    </>
  );
}
