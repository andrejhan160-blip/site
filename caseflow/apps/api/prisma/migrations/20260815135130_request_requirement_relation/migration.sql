-- AddForeignKey
ALTER TABLE "client_requests" ADD CONSTRAINT "client_requests_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "document_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
