import { StarIcon } from "@/components/icons";

type RatingProps = {
  rating: number;
  reviewCount: number;
  className?: string;
};

export function Rating({ rating, reviewCount, className = "" }: RatingProps) {
  if (reviewCount === 0) {
    return (
      <div className={`flex items-center gap-1.5 text-sm ${className}`}>
        <StarIcon className="h-4 w-4 text-faint" />
        <span className="text-muted-soft">No reviews yet</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 text-sm ${className}`}>
      <StarIcon className="h-4 w-4 text-accent-bright" />
      <span aria-hidden="true" className="font-semibold text-foreground">
        {rating.toFixed(1)}
      </span>
      <span aria-hidden="true" className="text-muted-soft">
        ({reviewCount})
      </span>
      <span className="sr-only">
        Rated {rating.toFixed(1)} out of 5 from {reviewCount} reviews
      </span>
    </div>
  );
}
