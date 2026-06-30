import { Star } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar';

const avatarItems = [
  { label: 'G', className: 'bg-sky-100 text-sky-700' },
  { label: 'P', className: 'bg-emerald-100 text-emerald-700' },
  { label: 'T', className: 'bg-amber-100 text-amber-700' },
  { label: '1', className: 'bg-violet-100 text-violet-700' },
  { label: '0', className: 'bg-rose-100 text-rose-700' },
  { label: '1', className: 'bg-cyan-100 text-cyan-700' },
];

export function SocialAvatars({ tip }: { tip: string }) {
  return (
    <div className="mx-auto mt-8 flex w-fit flex-col items-center gap-2 sm:flex-row">
      <span className="mx-4 inline-flex items-center -space-x-2">
        {avatarItems.map((avatar, index) => (
          <Avatar className="size-10 border" key={index}>
            <AvatarFallback
              className={`text-sm font-semibold ${avatar.className}`}
            >
              {avatar.label}
            </AvatarFallback>
          </Avatar>
        ))}
      </span>
      <div className="flex flex-col items-center gap-1 md:items-start">
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, index) => (
            <Star
              key={index}
              className="size-4 fill-yellow-400 text-yellow-400"
            />
          ))}
        </div>
        <p className="text-muted-foreground text-left text-sm font-normal">
          {tip}
        </p>
      </div>
    </div>
  );
}
