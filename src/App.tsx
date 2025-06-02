import { useEffect, useState } from "react";
import Squares from "./components/Squares";

type Beacon = "BC572913EA8B" | "BC572905D5B3" | "BC572905D5B9";
type BeaconData = { key: string; distance: number };
type BeaconState = Record<Beacon, BeaconData[]>;

const App: React.FC = () => {
  const defaultKeys = ["282C02227F53", "282C02227FDD", "282C02227F1A"];
  const initialBeaconState: BeaconState = {
    BC572913EA8B: defaultKeys.map((key) => ({ key, distance: 0 })),
    BC572905D5B3: defaultKeys.map((key) => ({ key, distance: 0 })),
    BC572905D5B9: defaultKeys.map((key) => ({ key, distance: 0 })),
  };

  const [beaconData, setBeaconData] = useState(initialBeaconState);

  // Helper function to merge new data and ensure all default keys are present
  const mergeDataWithDefaults = (
    existingData: BeaconState,
    newData: BeaconState
  ): BeaconState => {
    const mergedData = { ...existingData };
    (["BC572913EA8B", "BC572905D5B3", "BC572905D5B9"] as Beacon[]).forEach(
      (beacon) => {
        const beaconEntries = newData[beacon] || [];
        beaconEntries.forEach(({ key, distance }) => {
          const existingEntry = mergedData[beacon].find((e) => e.key === key);
          if (existingEntry) {
            existingEntry.distance = distance;
          }
        });

        // Add missing default keys with distance 0
        defaultKeys.forEach((key) => {
          if (!mergedData[beacon].some((entry) => entry.key === key)) {
            mergedData[beacon].push({
              key,
              distance:
                existingData[beacon].find((e) => e.key === key)?.distance || 0,
            });
          }
        });
      }
    );
    return mergedData;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/trackeddata.json");
        if (!response.ok) throw new Error("Network response was not ok");
        const json = await response.json();

        const tempData: BeaconState = JSON.parse(JSON.stringify(beaconData));

        Object.keys(json).forEach((key) => {
          json[key].forEach((entry: any) => {
            const { beacon, distance } = entry;
            if (tempData[beacon as Beacon]) {
              const existingEntry = tempData[beacon as Beacon].find(
                (e) => e.key === key
              );
              if (existingEntry && distance !== 0) {
                existingEntry.distance = distance ?? 0;
              }
            }
          });
        });

        // Merge new data with existing state
        const updatedData = mergeDataWithDefaults(beaconData, tempData);
        setBeaconData(updatedData);
      } catch (error) {
        console.error("ERROR fetching JSON:", error);
      }
    };

    const interval = setInterval(fetchData, 100);
    return () => clearInterval(interval);
  }, [beaconData]);

  useEffect(() => {
    const interval = setInterval(() => {
      console.log("Beacon Data with keys:", beaconData);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h1 style={{ textAlign: "center" }}>Beacon</h1>
      <Squares beaconData={beaconData} />
    </div>
  );
};

export default App;
