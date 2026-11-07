"use client";

import { Hydrated } from "@/components/app/hydrated";
import { PageHeader } from "@/components/app/page-header";
import { RequestGrid } from "@/components/requests/request-grid";

export default function RequestsPage() {
  return (
    <>
      <PageHeader
        title="シフト入力"
        description="その月の休み希望・出勤希望・入れない日や時間を入れます。ふだんの条件は「設定」のスタッフで決めます。"
      />
      <Hydrated>
        <RequestGrid />
      </Hydrated>
    </>
  );
}
