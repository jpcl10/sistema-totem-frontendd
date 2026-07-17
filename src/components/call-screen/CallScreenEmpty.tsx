type CallScreenEmptyProps = {
  title: string;
  description?: string;
};

export function CallScreenEmpty({ title, description }: CallScreenEmptyProps) {
  return (
    <div className="flex min-h-[240px] flex-1 items-center justify-center rounded-[24px] border border-white/10 bg-white/5 px-6 py-8 text-center backdrop-blur-xl">
      <div className="max-w-md">
        <h3 className="text-xl font-semibold text-white md:text-2xl">{title}</h3>
        {description && <p className="mt-2 text-sm text-white/60 md:text-base">{description}</p>}
      </div>
    </div>
  );
}

