import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from "react-native-svg";
import { Coffee, Utensils } from "lucide-react-native";
import type { Venue } from "./data";

export function DishArtwork({
  variant,
  background,
}: {
  variant: Venue["plate"];
  background: string;
}) {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 200 160"
      accessibilityLabel="Illustration of a sample dish"
    >
      <Rect width="200" height="160" fill={background} />
      <Ellipse cx="103" cy="90" rx="66" ry="54" fill="#263c3020" />
      <Circle cx="100" cy="78" r="59" fill="#fffdf7" />
      <Circle cx="100" cy="78" r="48" fill="#f1ede2" />
      {variant === "pasta" ? (
        <G>
          <Path
            d="M69 55q50 30 12 47M82 47q48 40 13 63M99 46q37 38 8 61M115 51q20 30 10 43M65 70q28-15 69 10M63 83q40-10 67 11"
            stroke="#d8ab59"
            strokeWidth="9"
            strokeLinecap="round"
            fill="none"
          />
          <Ellipse
            cx="80"
            cy="58"
            rx="11"
            ry="6"
            fill="#54754a"
            rotation="-25"
            origin="80,58"
          />
          <Ellipse
            cx="121"
            cy="88"
            rx="13"
            ry="6"
            fill="#54754a"
            rotation="25"
            origin="121,88"
          />
          <Circle cx="114" cy="58" r="6" fill="#b96043" />
          <Circle cx="78" cy="95" r="5" fill="#b96043" />
        </G>
      ) : (
        <G>
          <Ellipse
            cx="83"
            cy="62"
            rx="22"
            ry="16"
            fill="#5e7b4a"
            rotation="-20"
            origin="83,62"
          />
          <Ellipse
            cx="117"
            cy="70"
            rx="22"
            ry="17"
            fill="#7b934f"
            rotation="35"
            origin="117,70"
          />
          <Ellipse
            cx="87"
            cy="97"
            rx="24"
            ry="13"
            fill="#a9ad68"
            rotation="20"
            origin="87,97"
          />
          <Circle
            cx="117"
            cy="96"
            r="16"
            fill={variant === "brunch" ? "#f9f4d9" : "#c67d4d"}
          />
          <Circle
            cx="117"
            cy="96"
            r="8"
            fill={variant === "brunch" ? "#dbac43" : "#db9a66"}
          />
          <Circle cx="69" cy="80" r="8" fill="#b75f42" />
          <Circle cx="128" cy="53" r="7" fill="#b75f42" />
          <Path
            d="M71 54l20 8m15-4l17 12m-49 29l18-4"
            stroke="#c9d08b"
            strokeWidth="3"
          />
        </G>
      )}
      <Path
        d="M21 47v64m-5-64v22m10-22v22m-10 0h10M174 47v64m0-64q-11 12-4 29h4"
        fill="none"
        stroke="#75806a"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function NeighbourhoodMap({
  venues,
  selectedId,
  onSelect,
}: {
  venues: Venue[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={mapStyles.frame}>
      <Svg
        width="100%"
        height="246"
        viewBox="0 0 340 246"
        preserveAspectRatio="xMidYMid slice"
        accessible={false}
      >
        <Rect width="340" height="246" fill="#e9eddf" />
        <Rect x="15" y="19" width="73" height="61" rx="13" fill="#d9e3cb" />
        <Rect x="241" y="22" width="83" height="88" rx="16" fill="#d5dfc4" />
        <Rect x="138" y="156" width="94" height="74" rx="18" fill="#d7e1c7" />
        <Path
          d="M-10 196C82 153 51 223 159 200S273 216 354 177"
          stroke="#b9d6d2"
          strokeWidth="25"
          fill="none"
        />
        <G stroke="#fffdf6" strokeWidth="13" fill="none">
          <Path d="M-10 97L352 125" />
          <Path d="M98-15L73 260" />
          <Path d="M234-15L209 260" />
          <Path d="M-10 44L355 67" />
        </G>
        <G stroke="#d6dccc" strokeWidth="1" fill="none">
          <Path d="M-10 97L352 125" />
          <Path d="M98-15L73 260" />
          <Path d="M234-15L209 260" />
        </G>
        <Line
          x1="18"
          y1="157"
          x2="322"
          y2="175"
          stroke="#fdfbf5"
          strokeWidth="7"
        />
        <Line
          x1="161"
          y1="0"
          x2="144"
          y2="246"
          stroke="#fdfbf5"
          strokeWidth="7"
        />
        <Circle cx="157" cy="120" r="20" fill="#436f5c15" />
        <Circle cx="157" cy="120" r="11" fill="#ffffff" />
        <Circle cx="157" cy="120" r="7" fill="#547b69" />
      </Svg>
      <Text style={[mapStyles.place, { left: "10%", top: 26 }]}>CARLTON</Text>
      <Text style={[mapStyles.place, { left: "66%", top: 28 }]}>FITZROY</Text>
      <Text style={[mapStyles.place, { left: "71%", top: 213 }]}>
        COLLINGWOOD
      </Text>
      {venues.map((venue) => {
        const selected = selectedId === venue.id;
        const Icon = venue.category === "Cafe" ? Coffee : Utensils;
        return (
          <Pressable
            key={venue.id}
            accessibilityRole="button"
            accessibilityLabel={`Preview ${venue.name}`}
            accessibilityState={{ selected }}
            onPress={() => onSelect(venue.id)}
            style={[
              mapStyles.marker,
              { left: `${venue.mapX / 3.4}%`, top: venue.mapY - 22 },
              selected && mapStyles.selected,
            ]}
          >
            <Icon
              size={19}
              strokeWidth={1.8}
              color={selected ? "#ffffff" : "#2b5341"}
            />
          </Pressable>
        );
      })}
      <View style={mapStyles.caption}>
        <Text style={mapStyles.captionText}>
          Illustrative map. No live location.
        </Text>
      </View>
    </View>
  );
}

const mapStyles = StyleSheet.create({
  frame: {
    height: 246,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#e9eddf",
    position: "relative",
  },
  place: {
    position: "absolute",
    fontSize: 9,
    color: "#697563",
    fontWeight: "600",
    letterSpacing: 1.4,
  },
  marker: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#fffef9",
    borderColor: "#d6dece",
    borderWidth: 1,
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -23,
  },
  selected: { backgroundColor: "#2b5341", borderColor: "#2b5341" },
  caption: {
    position: "absolute",
    bottom: 9,
    left: 10,
    backgroundColor: "#fffef9ed",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
  },
  captionText: { fontSize: 10, color: "#52614e" },
});
