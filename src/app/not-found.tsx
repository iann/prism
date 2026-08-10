import Link from 'next/link';
import { Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WallStateScreen } from '@/components/wall';

export default function NotFound() {
  return (
    <WallStateScreen
      icon={<Home className="h-8 w-8" aria-hidden="true" />}
      eyebrow="404"
      title="That page isn’t here"
      description="It may have moved, but your family dashboard is ready whenever you are."
      actions={
        <Button asChild size="touch">
          <Link href="/">Back to dashboard</Link>
        </Button>
      }
    />
  );
}
