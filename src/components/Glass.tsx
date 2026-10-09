import type { ComponentProps, ReactNode } from "react";
import type { FlexAlignType } from "react-native";
import { Host, Image as SwiftImage, Text as SwiftText } from "@expo/ui/swift-ui";
import {
  font,
  foregroundStyle,
  glassEffect,
  onTapGesture,
  padding,
  strokeBorder,
  type Color,
  type ViewModifier,
} from "@expo/ui/swift-ui/modifiers";

type GlassShape = "capsule" | "circle" | "roundedRectangle" | "rectangle" | "ellipse";
type GlassVariant = "regular" | "clear" | "identity";
type GlassWeight = NonNullable<Parameters<typeof font>[0]["weight"]>;
type SymbolName = NonNullable<ComponentProps<typeof SwiftImage>["systemName"]>;

type GlassPadding = {
  all?: number;
  horizontal?: number;
  vertical?: number;
};

type GlassProps = {
  shape?: GlassShape;
  cornerRadius?: number;
  variant?: GlassVariant;
  selectedVariant?: GlassVariant;
  interactive?: boolean;
  tint?: Color;
  color?: Color;
  border?: Color;
  selected?: boolean;
  selectedTint?: Color;
  selectedColor?: Color;
  selectedBorder?: Color;
  padding?: GlassPadding;
  onPress?: () => void;
  modifiers?: ViewModifier[];
};

function glassModifiers(props: GlassProps, fallbackPadding: GlassPadding): ViewModifier[] {
  const on = props.selected === true;
  const tint = on && props.selectedTint !== undefined ? props.selectedTint : props.tint;
  const color = on && props.selectedColor !== undefined ? props.selectedColor : props.color;
  const border = on && props.selectedBorder !== undefined ? props.selectedBorder : props.border;
  const variant = (on ? props.selectedVariant : undefined) ?? props.variant ?? "regular";
  const shape = props.shape ?? "capsule";
  const radius = props.cornerRadius;

  return [
    ...(color != null ? [foregroundStyle(color)] : []),
    padding(props.padding ?? fallbackPadding),
    glassEffect({
      glass: {
        variant,
        interactive: props.interactive ?? true,
        ...(tint != null ? { tint } : {}),
      },
      shape,
      ...(radius != null ? { cornerRadius: radius } : {}),
    }),
    ...(border != null
      ? [
          strokeBorder({
            content: border,
            style: { lineWidth: 1 },
            shape,
            ...(radius != null ? { cornerRadius: radius } : {}),
          }),
        ]
      : []),
    ...(props.onPress ? [onTapGesture(props.onPress)] : []),
    ...(props.modifiers ?? []),
  ];
}

function glassLabel(children: ReactNode): string {
  if (children == null || typeof children === "boolean") return "";
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(glassLabel).join("");
  return "";
}

export function GlassText({
  children,
  size = 11,
  weight = "semibold",
  alignSelf = "center",
  ...props
}: GlassProps & { children: ReactNode; size?: number; weight?: GlassWeight; alignSelf?: FlexAlignType }) {
  return (
    <Host matchContents ignoreSafeArea="all" style={{ alignSelf }}>
      <SwiftText modifiers={[font({ weight, size }), ...glassModifiers(props, { horizontal: 12, vertical: 6 })]}>
        {glassLabel(children)}
      </SwiftText>
    </Host>
  );
}

export function GlassIcon({
  name,
  size = 15,
  shape = "circle",
  alignSelf = "center",
  ...props
}: GlassProps & { name: SymbolName; size?: number; alignSelf?: FlexAlignType }) {
  const on = props.selected === true;
  const color = on && props.selectedColor !== undefined ? props.selectedColor : props.color;
  return (
    <Host matchContents ignoreSafeArea="all" style={{ alignSelf }}>
      <SwiftImage
        systemName={name}
        size={size}
        {...(color != null ? { color } : {})}
        modifiers={glassModifiers({ ...props, shape, color: undefined }, { all: 10 })}
      />
    </Host>
  );
}
