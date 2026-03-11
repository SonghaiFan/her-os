import { HerOsExperience } from "@/components/her-os-experience";
import qasdb from "@/src/data/qasdb.json";

export default function Home() {
  return <HerOsExperience qas={qasdb} />;
}
