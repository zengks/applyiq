import ConfirmationForm from './ConfirmationForm';
import LoginForm from './LoginForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; resend?: string | string[] }>;
}) {
  const { error, resend } = await searchParams;
  const confirmationFailed = error === 'callback' || error === 'confirm';
  if (confirmationFailed || resend === 'confirmation') {
    return <ConfirmationForm confirmationFailed={confirmationFailed} />;
  }
  return <LoginForm />;
}
