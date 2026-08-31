ALTER TABLE "articles" ALTER COLUMN "category_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" DROP CONSTRAINT "articles_category_id_article_categories_id_fkey";--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_category_id_article_categories_id_fkey" FOREIGN KEY ("category_id") REFERENCES "article_categories"("id") ON DELETE SET NULL;
