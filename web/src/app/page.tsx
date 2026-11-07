"use client";

import { Hydrated } from "@/components/app/hydrated";
import { PageHeader } from "@/components/app/page-header";
import { ScheduleBoard } from "@/components/schedule/schedule-board";

export default function SchedulePage() {
  return (
    <>
      <div className="print:hidden">
        <PageHeader title="シフト表" description="設定とシフト入力の内容から、シフトを自動で作ります。" />
      </div>
      <Hydrated>
        <ScheduleBoard />
      </Hydrated>
    </>
  );
}
