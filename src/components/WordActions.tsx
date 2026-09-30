import { useState } from 'react';
import { Check, Copy, Image, Search } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';

export const googleImagesUrl = (word: string): string => `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(word)}`;
export const googleSearchUrl = (word: string): string => `https://www.google.com/search?q=${encodeURIComponent(word)}+definition`;

/** Copy-to-clipboard and Google Images buttons for a word; used on the card and in the story hover card. */
export function WordActions({ word, size = 16 }: { word: string; size?: number }) {
  const [copied, setCopied] = useState(false);
  const copy = async (): Promise<void> => {
    try { await navigator.clipboard.writeText(word); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* clipboard unavailable */ }
  };
  const cls = 'inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-primary';
  return (
    <span className="inline-flex items-center gap-0.5">
      <Tooltip><TooltipTrigger asChild><button type="button" onClick={() => void copy()} className={cls} aria-label="Copy word">{copied ? <Check style={{ width: size, height: size }} className="text-know" /> : <Copy style={{ width: size, height: size }} />}</button></TooltipTrigger><TooltipContent>{copied ? 'Copied' : 'Copy'}</TooltipContent></Tooltip>
      <Tooltip><TooltipTrigger asChild><a href={googleSearchUrl(word)} target="_blank" rel="noopener" className={cls} aria-label="Search Google"><Search style={{ width: size, height: size }} /></a></TooltipTrigger><TooltipContent>Google definition</TooltipContent></Tooltip>
      <Tooltip><TooltipTrigger asChild><a href={googleImagesUrl(word)} target="_blank" rel="noopener" className={cls} aria-label="Search Google Images"><Image style={{ width: size, height: size }} /></a></TooltipTrigger><TooltipContent>Google Images</TooltipContent></Tooltip>
    </span>
  );
}
