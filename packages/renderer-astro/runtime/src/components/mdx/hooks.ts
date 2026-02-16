export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export function onHeading(level: HeadingLevel, props: Record<string, unknown>): Record<string, unknown> {
  const children = props.children;
  const asText = Array.isArray(children) ? children.join(' ') : String(children ?? '');
  const id =
    typeof props.id === 'string'
      ? props.id
      : `h-${level}-${asText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;

  return {
    ...props,
    id
  };
}

export function onLink(props: Record<string, unknown>): Record<string, unknown> {
  const href = typeof props.href === 'string' ? props.href : '';

  if (href.startsWith('http://') || href.startsWith('https://')) {
    return {
      ...props,
      target: '_blank',
      rel: 'noreferrer'
    };
  }

  return props;
}
