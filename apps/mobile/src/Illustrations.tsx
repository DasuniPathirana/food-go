import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { G, Path, Rect, Text as SvgText } from "react-native-svg";
import type { Venue } from "./data";

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
    <View style={styles.frame}>
      <Svg
        width="100%"
        height="306"
        viewBox="0 0 340 306"
        preserveAspectRatio="xMidYMid slice"
        accessible={false}
      >
        <Rect width="340" height="306" fill="#eaece2" />
        <G fill="#dce1d2">
          <Rect x="14" y="14" width="65" height="67" rx="4" />
          <Rect x="88" y="17" width="55" height="62" rx="4" />
          <Rect x="161" y="20" width="73" height="60" rx="4" />
          <Rect x="252" y="23" width="75" height="62" rx="4" />
          <Rect x="15" y="99" width="61" height="74" rx="4" />
          <Rect x="94" y="100" width="51" height="67" rx="4" />
          <Rect x="165" y="103" width="68" height="65" rx="4" />
          <Rect x="253" y="107" width="72" height="62" rx="4" />
        </G>
        <Path
          d="M3 200C75 160 111 220 174 206S263 191 345 224"
          stroke="#bad0cd"
          strokeWidth="28"
          fill="none"
        />
        <Path
          d="M-10 90L348 98M84-10L77 312M151-10L155 312M243-10L246 312M-10 181L348 177M-10 270L350 282"
          stroke="#fffdf6"
          strokeWidth="12"
          fill="none"
        />
        <Path
          d="M-10 90L348 98M151-10L155 312"
          stroke="#cfb88d"
          strokeWidth="2"
          fill="none"
        />
        <Path
          d="M168 228l59 4v38l-59-5zM15 215l51 10-1 39-51-3z"
          fill="#c9d5b8"
        />
        <Path
          d="M110 82Q182 48 258 112L172 245"
          fill="none"
          stroke="#a0aa96"
          strokeWidth="2"
          strokeDasharray="3 6"
        />
        <G fill="#56614d" fontSize="10" fontWeight="600" letterSpacing="1.2">
          <SvgText x="96" y="33">
            CARLTON
          </SvgText>
          <SvgText x="253" y="33">
            FITZROY
          </SvgText>
          <SvgText x="171" y="301">
            CITY CENTRE
          </SvgText>
        </G>
        <G fill="#56614d" fontSize="10">
          <SvgText x="18" y="160">
            Carlton Gardens
          </SvgText>
          <SvgText x="178" y="260">
            City gardens
          </SvgText>
        </G>
      </Svg>
      {venues.map((venue, index) => {
        const selected = selectedId === venue.id;
        return (
          <Pressable
            key={venue.id}
            accessibilityRole="button"
            accessibilityLabel={`Preview ${venue.name}`}
            accessibilityState={{ selected }}
            onPress={() => onSelect(venue.id)}
            style={[
              styles.marker,
              { left: `${venue.mapX / 3.4}%`, top: venue.mapY - 22 },
              selected && styles.markerSelected,
            ]}
          >
            <Text style={[styles.number, selected && styles.numberSelected]}>
              {String(index + 1).padStart(2, "0")}
            </Text>
          </Pressable>
        );
      })}
      <View style={styles.caption}>
        <Text style={styles.captionText}>
          Illustrative map · No live location
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    height: 306,
    borderRadius: 9,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#eaece2",
    borderWidth: 1,
    borderColor: "#d6dacc",
  },
  marker: {
    position: "absolute",
    marginLeft: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fffefa",
    borderColor: "#183d32",
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  markerSelected: { backgroundColor: "#b64a36", borderColor: "#b64a36" },
  number: { color: "#183d32", fontSize: 14, fontWeight: "700" },
  numberSelected: { color: "#fffefa" },
  caption: {
    position: "absolute",
    left: 9,
    bottom: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 5,
    backgroundColor: "#fffefaed",
  },
  captionText: { color: "#4d584b", fontSize: 11 },
});
