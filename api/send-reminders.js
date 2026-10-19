import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  const today = new Date().toISOString().split('T')[0];

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('is_completed', false)
    .lte('due_date', today);

  if (!tasks || tasks.length === 0) {
    return res.json({ message: 'No overdue tasks today' });
  }

  for (const task of tasks) {
    const { data: userData } = await supabase.auth.admin.getUserById(task.user_id);
    const email = userData?.user?.email;
    if (!email) continue;

    await resend.emails.send({
      from: 'TaskLite Pro <onboarding@resend.dev>',
      to: email,
      subject: `🔴 Reminder: ${task.title} is overdue`,
      html: `
        <h2>Hi there</h2>
        <p>Your task <strong>${task.title}</strong> is overdue.</p>
        <p>Due Date: ${task.due_date}</p>
        <p><a href="https://tasklite-pro.vercel.app">Open TaskLite Pro</a></p>
      `
    });
  }

  res.json({ sent: tasks.length });
}
