import { MaterialDesignIcons } from "@react-native-vector-icons/material-design-icons";
import { Tabs } from "expo-router";
import { colors } from "@/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.orange,
        tabBarInactiveTintColor: "#8a94a6",
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.line },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Claims",
          tabBarIcon: ({ color, size }) => (
            <MaterialDesignIcons name="file-document" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <MaterialDesignIcons name="cog" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
