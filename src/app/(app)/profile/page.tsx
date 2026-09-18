import type { Metadata } from "next";
import { requireAuth } from "@/lib/rbac/authorize";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfileForm } from "@/app/(app)/profile/profile-form";
import { ChangePasswordForm } from "@/app/(app)/profile/change-password-form";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireAuth();
  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-8">
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          <AvatarImage src={user.profileImageUrl ?? undefined} alt="" />
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {user.firstName} {user.lastName}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <Badge variant="secondary">{user.role.name}</Badge>
          </div>
        </div>
      </div>

      <Tabs defaultValue="profile" className="mt-8">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personal information</CardTitle>
              <CardDescription>
                Your role is managed by an administrator and can&apos;t be changed here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm
                firstName={user.firstName}
                lastName={user.lastName}
                jobTitle={user.jobTitle}
                phone={user.phone}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Change password</CardTitle>
              <CardDescription>
                Choose a strong password you haven&apos;t used elsewhere.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChangePasswordForm />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
