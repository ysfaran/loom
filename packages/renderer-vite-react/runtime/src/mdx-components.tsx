import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

type HeadingProps = ComponentPropsWithoutRef<'h1'>;

type HeadingHookContext = {
  level: HeadingLevel;
  props: HeadingProps;
};

type LinkHookContext = {
  props: ComponentPropsWithoutRef<'a'>;
};

export type RendererHooks = {
  onHeading?: (context: HeadingHookContext) => Partial<HeadingProps> | void;
  onLink?: (context: LinkHookContext) => Partial<ComponentPropsWithoutRef<'a'>> | void;
};

const defaultHooks: RendererHooks = {
  onHeading: ({ level, props }) => ({
    ...props,
    id: props.id ?? `h-${level}-${String(props.children).toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`
  }),
  onLink: ({ props }) => {
    if (!props.href) {
      return props;
    }

    if (props.href.startsWith('http://') || props.href.startsWith('https://')) {
      return {
        ...props,
        target: '_blank',
        rel: 'noreferrer'
      };
    }

    return props;
  }
};

function createHeading(level: HeadingLevel, hooks: RendererHooks) {
  switch (level) {
    case 1:
      return (props: HeadingProps) => {
        const overrides = hooks.onHeading?.({ level, props }) ?? {};
        return <h1 {...props} {...overrides} />;
      };
    case 2:
      return (props: HeadingProps) => {
        const overrides = hooks.onHeading?.({ level, props }) ?? {};
        return <h2 {...props} {...overrides} />;
      };
    case 3:
      return (props: HeadingProps) => {
        const overrides = hooks.onHeading?.({ level, props }) ?? {};
        return <h3 {...props} {...overrides} />;
      };
    case 4:
      return (props: HeadingProps) => {
        const overrides = hooks.onHeading?.({ level, props }) ?? {};
        return <h4 {...props} {...overrides} />;
      };
    case 5:
      return (props: HeadingProps) => {
        const overrides = hooks.onHeading?.({ level, props }) ?? {};
        return <h5 {...props} {...overrides} />;
      };
    default:
      return (props: HeadingProps) => {
        const overrides = hooks.onHeading?.({ level: 6, props }) ?? {};
        return <h6 {...props} {...overrides} />;
      };
  }
}

function Link(props: ComponentPropsWithoutRef<'a'>) {
  const overrides = defaultHooks.onLink?.({ props }) ?? {};
  return <a {...props} {...overrides} />;
}

export function useMDXComponents() {
  return {
    h1: createHeading(1, defaultHooks),
    h2: createHeading(2, defaultHooks),
    h3: createHeading(3, defaultHooks),
    h4: createHeading(4, defaultHooks),
    h5: createHeading(5, defaultHooks),
    h6: createHeading(6, defaultHooks),
    a: Link,
    wrapper: ({ children }: { children: ReactNode }) => <div className="mdx-content">{children}</div>
  };
}
