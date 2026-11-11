insert into public.site_content (id,section,label,kind,data,position,published) values
('link-telegram-bot','Контакты','Telegram-бот мастерской','link','{"href": "https://t.me/BratMasterBot"}'::jsonb,0,true),
('text-bot-label','Контакты','Подпись Telegram-бота','text','{"text": "Telegram-бот"}'::jsonb,0,true),
('text-bot-title','Контакты','Имя Telegram-бота','text','{"text": "@BratMasterBot"}'::jsonb,0,true),
('text-bot-caption','Контакты','Кнопка Telegram-бота','text','{"text": "Написать в Telegram"}'::jsonb,0,true)
on conflict (id) do nothing;
