/** Begrens de positie zonder lussen, ook als de balk tijdens navigatie geen breedte heeft. */
export function lichtkrantPositie(x:number,breedte:number,totaal:number):number|null {
 if(!Number.isFinite(x)||!Number.isFinite(breedte)||!Number.isFinite(totaal)||breedte<=0||totaal<=0)return null;
 return ((x % totaal + breedte) % totaal + totaal) % totaal - breedte;
}
