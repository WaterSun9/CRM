import logo from '../assets/watersun-logo-blue.png?inline';
import { freshTemplate } from './model';
export function brandedTemplate() {
    const template = freshTemplate();
    template.assets = { watersunLogoUrl:logo };
    return template;
}
