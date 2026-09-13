import type { Page } from "@/app/generated/prisma/client";

export type PageWithChildren = Page & {
  children: PageWithChildren[];
};
