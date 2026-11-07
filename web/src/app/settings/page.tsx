"use client";

import { Clock, ListChecks, Sun, Users, CalendarX } from "lucide-react";

import { Hydrated } from "@/components/app/hydrated";
import { PageHeader } from "@/components/app/page-header";
import { ProfileForm, WorkRulesForm } from "@/components/settings/basic-form";
import { BusinessHoursForm } from "@/components/settings/business-hours-form";
import { DemandForm } from "@/components/settings/demand-form";
import { SpecialDaysForm } from "@/components/settings/special-days-form";
import { StaffList } from "@/components/settings/staff-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="設定" description="お店とスタッフの、ふだんの条件を決めます。タブごとに保存してください。" />
      <Hydrated>
        <Tabs defaultValue="staff" className="gap-4">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="staff"><Users />スタッフ</TabsTrigger>
            <TabsTrigger value="hours"><Clock />営業時間</TabsTrigger>
            <TabsTrigger value="demand"><ListChecks />必要人数</TabsTrigger>
            <TabsTrigger value="days"><CalendarX />祝日・休業日</TabsTrigger>
            <TabsTrigger value="rules"><Sun />基本・ルール</TabsTrigger>
          </TabsList>
          <TabsContent value="staff"><StaffList /></TabsContent>
          <TabsContent value="hours"><BusinessHoursForm /></TabsContent>
          <TabsContent value="demand"><DemandForm /></TabsContent>
          <TabsContent value="days"><SpecialDaysForm /></TabsContent>
          <TabsContent value="rules" className="space-y-6">
            <ProfileForm />
            <WorkRulesForm />
          </TabsContent>
        </Tabs>
      </Hydrated>
    </>
  );
}
