import { Discovery } from "@/components/discovery";
import { getCatalogue } from "@/lib/catalogue-server";
export default async function Page() {
  return <Discovery catalogue={await getCatalogue()} />;
}
