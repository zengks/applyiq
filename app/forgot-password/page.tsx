import ForgotPasswordForm from './ForgotPasswordForm';

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return <ForgotPasswordForm expired={(await searchParams).error === 'callback'} />;
}
