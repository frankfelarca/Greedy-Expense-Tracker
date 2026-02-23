import { formatNum } from '../utils/helpers';

export default function Currency({ value, style, ...props }) {
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', ...style }} {...props}>
      &#8369;{formatNum(value)}
    </span>
  );
}
